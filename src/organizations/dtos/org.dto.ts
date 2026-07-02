export class OrgDto {
  id: string;
  name: string;
  description: string | null;
  plan: 'FREE' | 'PRO' | 'BUSINESS';
  createdAt: Date;
  updatedAt: Date;
}
