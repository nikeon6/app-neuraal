/**
 * DTO for notification response.
 * Used as output from use cases.
 */
export interface NotificationDTO {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  status: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}
