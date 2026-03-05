import * as bcrypt from 'bcrypt';
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

  static async hashPassword(password) {
    const saltRounds = 10;

    const hashedPassword = await new Promise((resolve, reject) => {
      bcrypt.genSalt(saltRounds, function (err, salt) {
        if (err) reject(new Error(err));

        // hash the password using our new salt
        bcrypt.hash(password, salt, function (err, hash) {
          if (err) reject(new Error(err));
          resolve(hash);
        });
      });
    });

    return hashedPassword;
  }
}
