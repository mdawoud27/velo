export interface InvitationPayload {
  to: string;
  orgName: string;
  role: string;
  inviterName: string;
  invitationUrl: string;
  declineInvitationUrl: string;
}
