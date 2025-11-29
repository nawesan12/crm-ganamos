# Team/Cashier Management Inconsistencies Found

## Critical Issues Identified

### 1. ❌ No Duplicate Username Validation
**Location:** `addTeamMember()` and `addCashier()`
**Problem:** Both functions create users without checking if username already exists
**Risk:** Database constraint violation error, poor user experience

### 2. ❌ Inconsistent Return Types
**Location:** `addCashier()` vs `addTeamMember()`
**Problem:**
- `addCashier()` returns `{ teamMember, cashier }`
- `addTeamMember()` only returns `TeamMember`
**Impact:** UI has to handle different response structures

### 3. ❌ Duplicate User Creation Logic
**Problem:** Same user creation code exists in both functions
**Impact:** Violates DRY principle, harder to maintain

### 4. ❌ Missing Password Validation
**Problem:** No minimum length, strength requirements
**Risk:** Weak passwords allowed

### 5. ❌ Input Trimming Inconsistency
**Problem:** Trimming happens in different places:
- Sometimes validated before trim: `if (!name)`
- Sometimes trimmed in DB operation: `name.trim()`
**Impact:** Empty string " " passes validation

### 6. ❌ ContactChannel Enum Inconsistency
**Location:** `prisma/schema.prisma`
**Problem:** Mixed naming conventions:
- `PHONE_CALL` (snake_case)
- `INSTAGRAM`, `TIKTOK` (SCREAMING_CASE)

### 7. ⚠️ PaymentMethod Naming Inconsistency
**Location:** `prisma/schema.prisma`
**Problem:**
- `DEBIT_CARD`, `CREDIT_CARD` (snake_case)
- `CASH`, `OTHER` (SCREAMING_CASE)
- `BANK_TRANSFER` (snake_case)

### 8. ❌ Missing Unique Constraint Error Handling
**Problem:** If username exists, Prisma throws raw error
**Impact:** Generic error message shown to user

## Files Affected
- `actions/admin.ts`
- `prisma/schema.prisma`
- `app/(dashboard)/admin/page.tsx`
