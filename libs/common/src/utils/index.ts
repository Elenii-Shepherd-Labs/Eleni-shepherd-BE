import { randomBytes, scrypt as scryptCallback } from 'crypto';

const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });

export class Utils {
  static isEmail(email: string): boolean {
    const reg = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
    if (reg.test(email) == false) {
      return false;
    }

    return true;
  }

  static generateToken(length = 6) {
    return Math.floor(
      Math.pow(10, length - 1) +
        Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1) - 1),
    );
  }

  static async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hashedPassword = await scrypt(password, salt);

    return `${salt}:${hashedPassword.toString('hex')}`;
  }
}
