import "server-only";
import type {
  PacketAdapter,
  SignerAdapter,
  RegistryAdapter,
  UserAdapter,
  NotaryAdapter,
  PaymentAdapter,
} from "./server-types";
import {
  SupabasePacketAdapter,
  SupabaseSignerAdapter,
  SupabaseRegistryAdapter,
  SupabaseUserAdapter,
  SupabaseNotaryAdapter,
  SupabasePaymentAdapter,
} from "./supabase-adapter";

export function getPacketAdapter(): PacketAdapter {
  return new SupabasePacketAdapter();
}

export function getSignerAdapter(): SignerAdapter {
  return new SupabaseSignerAdapter();
}

export function getRegistryAdapter(): RegistryAdapter {
  return new SupabaseRegistryAdapter();
}

export function getUserAdapter(): UserAdapter {
  return new SupabaseUserAdapter();
}

export function getNotaryAdapter(): NotaryAdapter {
  return new SupabaseNotaryAdapter();
}

export function getPaymentAdapter(): PaymentAdapter {
  return new SupabasePaymentAdapter();
}
