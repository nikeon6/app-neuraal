export interface UserDTO {
  id: string;
  email: string;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResultDTO {
  user: UserDTO;
  tokens: AuthTokensDTO;
}
