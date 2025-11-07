export type AuthRole = "ADMIN" | "CASHIER" | "AGENT";

export type AuthUser = {
  id: number;
  name: string;
  username: string;
  role: AuthRole;
};

export type LoginResponse =
  | {
      success: true;
      user: AuthUser;
    }
  | {
      success: false;
      error: string;
    };
