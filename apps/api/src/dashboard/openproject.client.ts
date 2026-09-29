import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const INVALID_CONFIGURATION_MESSAGE = 'OpenProject scan configuration is invalid.';
const CONNECTIVITY_MESSAGE = 'OpenProject could not be reached. Check server connectivity and the configured base URL.';
const CREDENTIALS_MESSAGE = 'OpenProject rejected the configured credentials or project access.';
const PROJECT_MESSAGE = 'The configured OpenProject project could not be found or accessed.';
const TEMPORARY_MESSAGE = 'OpenProject is temporarily unavailable. Try the scan again later.';
const INVALID_RESPONSE_MESSAGE = 'OpenProject returned an invalid scan response.';
const REQUEST_TIMEOUT_MS = 10000;

function scanError(message: string): ServiceUnavailableException {
  return new ServiceUnavailableException(message);
}

export type OpenProjectWorkPackage = {
  subject?: unknown;
  dueDate?: unknown;
};

type OpenProjectPage = {
  _embedded?: { elements?: OpenProjectWorkPackage[] };
  total?: number;
  offset?: number;
  pageSize?: number;
};

export type OpenProjectConfig = {
  baseUrl: string;
  token: string;
  projectIdentifier: string;
  milestoneDate: string;
};

@Injectable()
export class OpenProjectClient {
  private readonly logger = new Logger(OpenProjectClient.name);

  private context(projectIdentifier?: string, offset?: number, pageSize?: number) {
    return { projectIdentifier: projectIdentifier ?? 'unset', ...(offset === undefined ? {} : { offset }), ...(pageSize === undefined ? {} : { pageSize }) };
  }

  private config(): OpenProjectConfig {
    const rawBaseUrl = process.env.OPENPROJECT_BASE_URL?.trim();
    const token = process.env.OPENPROJECT_API_TOKEN?.trim();
    const projectIdentifier = process.env.OPENPROJECT_PROJECT_IDENTIFIER?.trim();
    const milestoneDate = '2026-10-03';
    this.logger.log(`OpenProject configuration validation started, ${JSON.stringify({ hasBaseUrl: Boolean(rawBaseUrl), hasToken: Boolean(token), hasProjectIdentifier: Boolean(projectIdentifier) })}`);
    if (!rawBaseUrl || !token || !projectIdentifier) {
      this.logger.warn('OpenProject configuration validation failed, missing required setting');
      throw scanError(INVALID_CONFIGURATION_MESSAGE);
    }

    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(rawBaseUrl);
    } catch (error) {
      this.logger.warn(`OpenProject configuration validation failed, ${this.errorDetails(error)}`);
      throw scanError(INVALID_CONFIGURATION_MESSAGE);
    }
    const path = parsedBaseUrl.pathname;
    this.logger.log(`OpenProject configuration validated, ${JSON.stringify({ protocol: parsedBaseUrl.protocol, hostname: parsedBaseUrl.hostname, hasNonRootPath: path !== '/', hasApiLookingPath: /(^|\/)api(\/|$)/i.test(path) })}`);
    if (parsedBaseUrl.protocol !== 'http:' && parsedBaseUrl.protocol !== 'https:') {
      this.logger.warn('OpenProject configuration validation failed, unsupported protocol');
      throw scanError(INVALID_CONFIGURATION_MESSAGE);
    }
    if (/\/api(?:\/|$)/i.test(path)) this.logger.warn('OpenProject base path appears to include /api, request builder appends /api/v3');
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    return { baseUrl, token, projectIdentifier, milestoneDate };
  }

  async listWorkPackages(): Promise<OpenProjectWorkPackage[]> {
    const config = this.config();
    const workPackages: OpenProjectWorkPackage[] = [];
    const pageSize = 100;
    // OpenProject API v3 paginates by 1-based page number in the `offset` parameter,
    // not by item index, and echoes that page number back as `offset`.
    let pageNumber = 1;

    while (true) {
      const url = new URL(`${config.baseUrl}/api/v3/projects/${encodeURIComponent(config.projectIdentifier)}/work_packages`);
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('offset', String(pageNumber));
      this.logger.log(`OpenProject pagination request, ${JSON.stringify(this.context(config.projectIdentifier, pageNumber, pageSize))}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/hal+json',
            Authorization: `Basic ${Buffer.from(`apikey:${config.token}`).toString('base64')}`,
          },
        });
      } catch (error) {
        this.logger.warn(`OpenProject fetch failed, ${JSON.stringify({ ...this.context(config.projectIdentifier, pageNumber, pageSize), stage: 'fetch', error: this.errorDetails(error) })}`);
        throw scanError(CONNECTIVITY_MESSAGE);
      } finally {
        clearTimeout(timeout);
      }
      this.logger.log(`OpenProject response received, ${JSON.stringify({ ...this.context(config.projectIdentifier, pageNumber, pageSize), status: response.status })}`);
      if (response.status === 400) {
        const category = await this.classifyBadRequest(response);
        this.logger.warn(`OpenProject HTTP 400 diagnostic, ${JSON.stringify({ ...this.context(config.projectIdentifier, pageNumber, pageSize), status: response.status, contentType: response.headers.get('content-type') ?? 'unknown', category })}`);
        throw scanError(CONNECTIVITY_MESSAGE);
      }
      if (response.status === 401 || response.status === 403) throw scanError(CREDENTIALS_MESSAGE);
      if (response.status === 404) throw scanError(PROJECT_MESSAGE);
      if (response.status === 429 || response.status >= 500) throw scanError(TEMPORARY_MESSAGE);
      if (!response.ok) throw scanError(CONNECTIVITY_MESSAGE);

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'invalid-json', undefined);
        this.logger.warn(`OpenProject JSON parse failed, ${JSON.stringify(this.errorDetails(error))}`);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'root-not-object', payload);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      const page = payload as OpenProjectPage;
      if (!('_embedded' in page) || !page._embedded || typeof page._embedded !== 'object' || Array.isArray(page._embedded)) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'embedded-not-object', payload);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      const embedded = page._embedded as { elements?: unknown };
      if (!Array.isArray(embedded.elements)) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'elements-not-array', payload);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      if (page.total !== undefined && (!Number.isInteger(page.total) || page.total < 0)) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'invalid-total', payload);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      if (page.offset !== undefined && (!Number.isInteger(page.offset) || page.offset < 1)) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'invalid-offset', payload);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      if (page.offset !== undefined && page.offset !== pageNumber) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'offset-mismatch', payload);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      if (page.pageSize !== undefined && (!Number.isInteger(page.pageSize) || page.pageSize <= 0)) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'invalid-page-size', payload);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      const elements = embedded.elements;
      const reportedPageSize = page.pageSize ?? pageSize;
      if (elements.length > reportedPageSize) {
        this.logValidationFailure(config.projectIdentifier, pageNumber, pageSize, response, 'element-count-exceeds-page-size', payload);
        throw scanError(INVALID_RESPONSE_MESSAGE);
      }
      workPackages.push(...elements);
      this.logger.log(`OpenProject pagination validated, ${JSON.stringify({ ...this.context(config.projectIdentifier, pageNumber, pageSize), total: page.total, returned: elements.length, collected: workPackages.length, nextPage: pageNumber + 1 })}`);
      if (elements.length === 0 || elements.length < reportedPageSize) break;
      if (page.total !== undefined && workPackages.length >= page.total) break;
      pageNumber += 1;
    }
    return workPackages;
  }

  private logValidationFailure(projectIdentifier: string, pageNumber: number, pageSize: number, response: Response, validationFailure: string, payload: unknown) {
    const root = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : undefined;
    const embedded = root?._embedded && typeof root._embedded === 'object' && !Array.isArray(root._embedded) ? root._embedded as Record<string, unknown> : undefined;
    const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    this.logger.warn(`OpenProject collection validation failed, ${JSON.stringify({ projectIdentifier, requestedOffset: pageNumber, requestedPageSize: pageSize, status: response.status, contentType: response.headers.get('content-type') ?? 'unknown', validationFailure, rootKeys: root ? Object.keys(root).sort().slice(0, 20) : [], embeddedKeys: embedded ? Object.keys(embedded).sort().slice(0, 20) : [], hasRootObject: Boolean(root), hasEmbeddedObject: Boolean(embedded), hasElementsArray: Boolean(embedded && Array.isArray(embedded.elements)), total: numeric(root?.total), offset: numeric(root?.offset), pageSize: numeric(root?.pageSize), elementCount: Array.isArray(embedded?.elements) ? embedded.elements.length : undefined })}`);
  }

  private async classifyBadRequest(response: Response): Promise<string> {
    try {
      const limit = 16384;
      let body = '';
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (body.length < limit) {
          const chunk = await reader.read();
          if (chunk.done) break;
          body += decoder.decode(chunk.value, { stream: true });
          if (body.length >= limit) {
            await reader.cancel();
            break;
          }
        }
      } else {
        body = (await response.text()).slice(0, limit);
      }
      const lower = body.slice(0, limit).toLowerCase();
      if (lower.includes('select') && (lower.includes('parameter') || lower.includes('query'))) return 'invalid-query-parameter';
      if (lower.includes('field') || lower.includes('property') || lower.includes('selection')) return 'invalid-field-selection';
      if (lower.includes('pagesize') || lower.includes('offset') || lower.includes('pagination')) return 'invalid-pagination';
      if (lower.includes('project') && (lower.includes('identifier') || lower.includes('id'))) return 'invalid-project-identifier';
    } catch (error) {
      this.logger.debug(`OpenProject HTTP 400 payload inspection failed, ${this.errorDetails(error).name}`);
    }
    return 'unclassified-client-error';
  }

  private errorDetails(error: unknown) {
    if (error instanceof Error) return { name: error.name, message: error.message, cause: error.cause instanceof Error ? error.cause.name : typeof error.cause === 'string' ? error.cause : undefined };
    return { name: typeof error, message: 'non-Error failure' };
  }

  getScanConfig(): OpenProjectConfig {
    return this.config();
  }
}
