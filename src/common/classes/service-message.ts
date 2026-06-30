export class ServiceMessage {
  readonly __type = 'ServiceMessage' as const;
  constructor(public readonly message: string) {}
}
