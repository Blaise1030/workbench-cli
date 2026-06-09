export {
  useAgentsQuery,
  usePatchAgentsMutation,
  useCreateAgentMutation,
  useDeleteAgentMutation,
} from "@/modules/settings/queries/agents";
export {
  settingsKeys,
  networkSettingsQueryOptions,
  terminalSettingsQueryOptions,
  terminalResumePrefixesQueryOptions,
  useNetworkSettingsQuery,
  useTerminalSettingsQuery,
  useTerminalResumePrefixesQuery,
  usePatchNetworkSettingsMutation,
  usePatchTerminalSettingsMutation,
  useAddResumePrefixMutation,
  useRevokeResumePrefixMutation,
} from "./settings";
