import type {
  QualificationStore,
} from '../lead-qualification/lead-qualification.repository.js';
import {
  LeadQualificationService,
  type StartOptions,
} from '../lead-qualification/lead-qualification.service.js';
import type { RunView } from '../lead-qualification/lead-qualification.service.js';
import {
  ContactDiscoveryQualifier,
  CONTACT_DISCOVERY_POLICY,
  CONTACT_DISCOVERY_VERSION,
} from './contact-discovery.qualifier.js';
import type { ContactDiscoveryPipeline } from './contact-discovery-pipeline.js';

/**
 * Independently callable Stage 05 V1 runtime.
 *
 * It reuses the existing run/result persistence, lease, recovery, progress and
 * publication machinery without changing the schema. It does not start
 * automatically after Stage 04.
 */
export class ContactDiscoveryRuntime {
  private readonly service: LeadQualificationService;

  constructor(store: QualificationStore, pipeline: ContactDiscoveryPipeline) {
    this.service = new LeadQualificationService(
      store,
      new ContactDiscoveryQualifier(pipeline),
    );
  }

  start(researchId: string, options: StartOptions = {}): Promise<RunView> {
    return this.service.start(researchId, {
      ...options,
      autoStart: options.autoStart ?? false,
      qualificationVersion: CONTACT_DISCOVERY_VERSION,
      policyVersion: CONTACT_DISCOVERY_POLICY,
      promptVersion: null,
    });
  }

  execute(runId: string): Promise<RunView> {
    return this.service.execute(runId);
  }

  resume(runId: string): Promise<RunView> {
    return this.service.resume(runId);
  }

  getRun(runId: string): Promise<RunView> {
    return this.service.getRun(runId);
  }

  getLatest(researchId: string): Promise<RunView> {
    return this.service.getLatest(researchId);
  }

  listResults(
    runId: string,
    options?: Parameters<LeadQualificationService['listResults']>[1],
  ): ReturnType<LeadQualificationService['listResults']> {
    return this.service.listResults(runId, options);
  }

  getResult(
    runId: string,
    resultId: string,
  ): ReturnType<LeadQualificationService['getResult']> {
    return this.service.getResult(runId, resultId);
  }
}
