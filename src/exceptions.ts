export class MaimaiJsError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidJsonError extends MaimaiJsError {}

export class InvalidPlayerIdentifierError extends MaimaiJsError {}

export class InvalidDeveloperTokenError extends MaimaiJsError {}

export class InvalidPlateError extends MaimaiJsError {}

export class PrivacyLimitationError extends MaimaiJsError {}

export class InvalidWechatTokenError extends MaimaiJsError {}

export class WechatTokenExpiredError extends InvalidWechatTokenError {}

export class ArcadeError extends MaimaiJsError {}
export class AimeServerError extends MaimaiJsError {}
export class ArcadeIdentifierError extends MaimaiJsError {}
export class TitleServerBlockedError extends MaimaiJsError {}
export class TitleServerNetworkError extends MaimaiJsError {}
