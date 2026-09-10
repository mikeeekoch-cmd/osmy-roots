import type { DataModules } from '../../packages/contracts';
import { AppError } from '../state/validation';
// Temporary integration boundary. Replaced by Claude's pushed module imports at handoff.
async function unavailable():Promise<never>{throw new AppError('Ingestion, retrieval and export modules are awaiting the worker handoff.',503,'MODULE_NOT_INTEGRATED')}
export const dataModules:DataModules={importPreparedFamily:unavailable,ingestContribution:unavailable,searchLocalSources:unavailable,fetchPublicRecord:unavailable,buildFamilyBundle:unavailable};
