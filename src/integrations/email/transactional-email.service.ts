export interface AuthenticationEmailInput {
  actionUrl: string;
  recipientEmail: string;
  recipientName: string;
}

export abstract class TransactionalEmailService {
  abstract sendEmailVerification(
    input: AuthenticationEmailInput,
  ): Promise<void>;

  abstract sendPasswordReset(
    input: AuthenticationEmailInput,
  ): Promise<void>;
}
