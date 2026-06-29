export class UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  createdAt: Date;
}
