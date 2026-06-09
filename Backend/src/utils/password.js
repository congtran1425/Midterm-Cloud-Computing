import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

export const verifyPassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);
