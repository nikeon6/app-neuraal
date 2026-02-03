/**
 * DTO for creating a topic.
 * Used as input for the CreateTopic use case.
 */
export interface CreateTopicDTO {
  name: string;
  color: string;
}

/**
 * DTO for topic response.
 * Used as output from use cases.
 */
export interface TopicDTO {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}
