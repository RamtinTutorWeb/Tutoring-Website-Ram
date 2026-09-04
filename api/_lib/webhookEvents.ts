import { getSupabaseAdmin } from './supabaseAdmin';

export type WebhookProvider = 'clerk' | 'calendly';

export interface RecordWebhookEventResult {
  /** True when an event with the same (provider, event_id) was already recorded. */
  duplicate: boolean;
}

/**
 * Inserts a row into `webhook_events` with "on conflict do nothing" semantics.
 * Call this before processing so a redelivered event is skipped. If processing
 * then fails, call `forgetWebhookEvent` so the provider's retry is reprocessed.
 */
export async function recordWebhookEvent(
  provider: WebhookProvider,
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<RecordWebhookEventResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('webhook_events')
    .upsert(
      { provider, event_id: eventId, event_type: eventType, payload },
      { onConflict: 'provider,event_id', ignoreDuplicates: true },
    )
    .select('id');

  if (error) {
    throw new Error(`webhook_events insert failed: ${error.message}`);
  }
  // With ignoreDuplicates the conflicting row is skipped and nothing is returned.
  return { duplicate: (data?.length ?? 0) === 0 };
}

/** Removes a previously recorded event so the provider's retry is not treated as a duplicate. */
export async function forgetWebhookEvent(provider: WebhookProvider, eventId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('webhook_events')
    .delete()
    .eq('provider', provider)
    .eq('event_id', eventId);
  if (error) {
    // Not fatal: worst case a retry is skipped. Log without payload details.
    console.error(`webhook_events cleanup failed for ${provider}:${eventId}: ${error.message}`);
  }
}
