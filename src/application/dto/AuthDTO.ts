export interface UserDTO {
  id: string;
  email: string;
  phoneNumber: string | null;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResultDTO {
  user: UserDTO;
  tokens: AuthTokensDTO;
}

export interface RegisterResultDTO {
  user: UserDTO;
  message: string;
}
