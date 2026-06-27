# Auth Module — Full Explanation

A complete walkthrough of every file, every line, every decision.

---

## Table of Contents

1. [Big Picture — How Auth Works](#1-big-picture)
2. [Folder Structure](#2-folder-structure)
3. [Prisma — Database Layer](#3-prisma)
4. [DTOs — Data Shape Validation](#4-dtos)
5. [JWT Strategy — Token Guard](#5-jwt-strategy)
6. [Auth Service — Business Logic](#6-auth-service)
7. [Auth Controller — HTTP Routes](#7-auth-controller)
8. [Auth Module — Wiring Everything](#8-auth-module)
9. [App Module — Root Registration](#9-app-module)
10. [Main.ts — App Bootstrap](#10-maints)
11. [Request Flow — Step by Step](#11-request-flow)
12. [How to Run](#12-how-to-run)

---

## 1. Big Picture

This is a **JWT (JSON Web Token) authentication system**. Here is the full concept before touching any code:

### What is JWT?

A JWT is a signed string split into 3 parts separated by dots:

```
header.payload.signature
```

Example:
```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifQ.abc123
```

- **Header** — algorithm used to sign (e.g. HS256)
- **Payload** — data stored inside the token (user id, email, expiry)
- **Signature** — cryptographic proof the token wasn't tampered with

The server signs the token with a **secret key**. When the client sends it back, the server verifies the signature. No database lookup needed to verify — that's why JWT is fast.

### Auth Flow Overview

```
REGISTER:
  Client sends email + password
    → Server hashes password (bcrypt)
    → Server saves user to DB
    → Server creates JWT token
    → Server returns token to client

LOGIN:
  Client sends email + password
    → Server finds user by email
    → Server compares password to hash (bcrypt)
    → Server creates JWT token
    → Server returns token to client

PROTECTED ROUTE:
  Client sends request + "Authorization: Bearer <token>" header
    → Passport extracts token from header
    → Passport verifies signature using secret key
    → Passport decodes payload (userId, email)
    → NestJS injects user into request object
    → Controller runs
```

### Why bcrypt for passwords?

Never store plain passwords. bcrypt:
1. Adds a random **salt** (prevents rainbow table attacks)
2. Runs a slow hashing algorithm (prevents brute force — takes ~100ms intentionally)
3. Produces a different hash every time even for the same password

```
bcrypt.hash("mypassword123", 10)
// "10" = cost factor = 2^10 = 1024 rounds of hashing
// Output: "$2b$10$randomsalt...hashedresult"
```

---

## 2. Folder Structure

```
src/
├── prisma/
│   ├── prisma.service.ts      # Database client (singleton)
│   └── prisma.module.ts       # Makes PrismaService available everywhere
│
├── auth/
│   ├── dto/
│   │   ├── register.dto.ts    # Shape + validation rules for register body
│   │   └── login.dto.ts       # Shape + validation rules for login body
│   │
│   ├── strategies/
│   │   └── jwt.strategy.ts    # Teaches Passport HOW to read/verify JWT
│   │
│   ├── auth.service.ts        # Business logic (register, login, sign token)
│   ├── auth.controller.ts     # HTTP routes (POST /auth/register, POST /auth/login)
│   └── auth.module.ts         # Wires all auth pieces together
│
├── app.module.ts              # Root module — imports everything
└── main.ts                    # App entry point — starts the server
```

---

## 3. Prisma

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"   // Where the generated client code goes
}

datasource db {
  provider = "postgresql"            // Database type
}

model User {
  id        String     @id @default(uuid())   // Auto UUID primary key
  email     String     @unique                // Must be unique across all users
  password  String                            // Stores the bcrypt hash (NOT plain text)
  createdAt DateTime   @default(now())        // Auto timestamp

  roles UserRole[]                            // Relation to roles (many-to-many)
}

model Role {
  id    String     @id @default(uuid())
  name  String     @unique

  users UserRole[]
}

model UserRole {
  userId String
  roleId String

  user User @relation(fields: [userId], references: [id])
  role Role @relation(fields: [roleId], references: [id])

  @@id([userId, roleId])   // Composite primary key — prevents duplicate user-role pairs
}
```

**Key concepts:**
- `@id` — marks the primary key column
- `@default(uuid())` — database generates a UUID automatically
- `@unique` — database enforces no duplicate values in this column
- `@default(now())` — database inserts current timestamp automatically
- `UserRole` is a **join table** for the many-to-many relationship between User and Role

---

### `src/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

**Line by line:**

| Code | Why |
|------|-----|
| `@Injectable()` | Tells NestJS this class can be injected into other classes |
| `extends PrismaClient` | PrismaService IS a PrismaClient — inherits all DB methods like `this.user.findUnique()` |
| `implements OnModuleInit` | NestJS lifecycle hook — `onModuleInit` runs when the module starts |
| `await this.$connect()` | Opens the database connection pool when the app boots |

**Why extend instead of wrap?**
By extending `PrismaClient`, `PrismaService` has all Prisma methods directly: `this.prisma.user.findUnique()`, `this.prisma.user.create()`, etc. No need to write `this.prisma.client.user.findUnique()`.

---

### `src/prisma/prisma.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Key concept — `@Global()`:**

Normally in NestJS, if Module A needs a service from Module B, Module A must import Module B. `@Global()` removes this requirement — once PrismaModule is loaded (in AppModule), its exports are available to **every module automatically**. You never have to import PrismaModule again.

Without `@Global()` every module needing the DB would need:
```typescript
imports: [PrismaModule]  // repeated everywhere — annoying
```

With `@Global()` — import once in AppModule, done.

---

## 4. DTOs

DTO = **Data Transfer Object**. It defines the shape and validation rules for incoming request bodies.

### `src/auth/dto/register.dto.ts`

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### `src/auth/dto/login.dto.ts`

```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

**How validation works:**

The decorators (`@IsEmail()`, `@MinLength(8)`) are metadata. Alone they do nothing. They need `ValidationPipe` (configured in `main.ts`) to run:

```
Incoming request body: { email: "notanemail", password: "abc" }
                                    ↓
                            ValidationPipe reads DTO decorators
                                    ↓
                            @IsEmail() fails → 400 Bad Request
                            { message: ["email must be an email"] }
```

`whitelist: true` in ValidationPipe strips any extra fields the client sends that aren't in the DTO. Prevents unwanted data from leaking into your service.

---

## 5. JWT Strategy

### `src/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: { sub: string; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

**Understanding `PassportStrategy`:**

Passport is an authentication middleware library. It uses a concept called **strategies** — pluggable ways to authenticate (JWT, Google OAuth, local username/password, etc.).

`PassportStrategy(Strategy)` wraps Passport's JWT strategy in NestJS syntax.

**`super({...})` — configuring how to read the token:**

| Option | What it does |
|--------|-------------|
| `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()` | Looks for token in `Authorization: Bearer <token>` header |
| `secretOrKey: config.get('JWT_SECRET')` | The secret used to verify the token signature (must match what signed it) |

**`validate(payload)`:**

After Passport extracts and verifies the token, it calls `validate()` with the decoded payload. Whatever you return here becomes available as `req.user` in your controllers.

```typescript
// Token payload (put there when signing):
{ sub: "user-uuid-123", email: "user@example.com" }

// validate() returns:
{ userId: "user-uuid-123", email: "user@example.com" }

// In controller:
@Get('profile')
@UseGuards(AuthGuard('jwt'))
getProfile(@Request() req) {
  console.log(req.user) // { userId: "...", email: "..." }
}
```

`sub` is JWT standard for "subject" — the entity the token is about (usually the user ID).

---

## 6. Auth Service

### `src/auth/auth.service.ts`

```typescript
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hash },
    });

    return this.signToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.signToken(user.id, user.email);
  }

  private async signToken(userId: string, email: string) {
    const token = await this.jwt.signAsync({ sub: userId, email });
    return { access_token: token };
  }
}
```

**Constructor injection:**

```typescript
constructor(
  private prisma: PrismaService,
  private jwt: JwtService,
) {}
```

NestJS's **Dependency Injection** system automatically creates and injects `PrismaService` and `JwtService`. You don't call `new PrismaService()` — NestJS manages the lifecycle and ensures singletons.

---

**`register()` step by step:**

```typescript
// Step 1: Check if email is taken
const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
if (exists) throw new ConflictException('Email already registered');
```
`ConflictException` → HTTP 409. Better than 400 — tells client specifically "this resource already exists".

```typescript
// Step 2: Hash the password
const hash = await bcrypt.hash(dto.password, 10);
```
Salt rounds = 10. Higher = slower = more secure but heavier on CPU. 10 is the industry standard default (~100ms on modern hardware).

```typescript
// Step 3: Save to database
const user = await this.prisma.user.create({
  data: { email: dto.email, password: hash },
});
```
Only `email` and `password` (the hash) are stored. The `id` and `createdAt` are auto-generated by the database.

```typescript
// Step 4: Sign and return JWT
return this.signToken(user.id, user.email);
```

---

**`login()` step by step:**

```typescript
// Step 1: Find user
const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
if (!user) throw new UnauthorizedException('Invalid credentials');
```

**Important:** the error message is generic — "Invalid credentials" — NOT "Email not found". This prevents **user enumeration** (attacker can't tell if an email is registered).

```typescript
// Step 2: Compare password to hash
const valid = await bcrypt.compare(dto.password, user.password);
if (!valid) throw new UnauthorizedException('Invalid credentials');
```
`bcrypt.compare()` hashes the incoming password with the same salt embedded in the stored hash and compares. Returns `true` or `false`.

---

**`signToken()` (private helper):**

```typescript
private async signToken(userId: string, email: string) {
  const token = await this.jwt.signAsync({ sub: userId, email });
  return { access_token: token };
}
```

`jwt.signAsync()` creates the JWT:
- **Payload** `{ sub: userId, email }` is embedded in the token
- **Secret** comes from the JwtModule config (reads `JWT_SECRET` from `.env`)
- **Expiry** comes from `JWT_EXPIRES_IN` (e.g. `15m` = 15 minutes)

Returns `{ access_token: "eyJ..." }` — standard OAuth2 response format.

---

## 7. Auth Controller

### `src/auth/auth.controller.ts`

```typescript
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

**`@Controller('auth')`** — all routes in this controller are prefixed with `/auth`

**`@Post('register')`** — maps to `POST /auth/register`

**`@Body() dto: RegisterDto`** — NestJS extracts `req.body`, passes it through ValidationPipe (because of the DTO type), and injects the validated object as `dto`.

**`@HttpCode(HttpStatus.OK)`** — by default, POST returns 201 (Created). Login doesn't create anything, so we override to 200.

**`HttpStatus.OK`** is just the number `200`. Using the enum makes it readable and avoids magic numbers.

---

## 8. Auth Module

### `src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

**`JwtModule.registerAsync()`:**

Why `registerAsync` instead of `register`? Because we need to read from `ConfigService` (which reads `.env`). `ConfigService` is only available at runtime after the DI container is ready — so we use the async factory pattern.

```typescript
JwtModule.registerAsync({
  inject: [ConfigService],           // "Give me ConfigService"
  useFactory: (config: ConfigService) => ({  // "Here's how to build the config"
    secret: config.get<string>('JWT_SECRET'),
    signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
    //                                        ^ second arg = default value if not set
  }),
})
```

**`providers: [AuthService, JwtStrategy]`** — both are injectable. JwtStrategy must be listed here so Passport registers it under the name `'jwt'` (used later in `@UseGuards(AuthGuard('jwt'))`).

---

## 9. App Module

### `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,    // ConfigService available everywhere, no re-import needed
    }),
    PrismaModule,        // @Global — PrismaService now available in every module
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

`ConfigModule.forRoot({ isGlobal: true })` — reads `.env` file and makes `ConfigService` injectable everywhere. Same concept as `@Global()`.

---

## 10. main.ts

### `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,             // Strip extra fields from body
      transform: true,             // Auto-convert types (e.g. string "123" → number 123)
      forbidNonWhitelisted: true,  // Throw error if extra fields sent (not just strip)
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setDescription('API documentation for the E-commerce application')
    .setVersion('1.0')
    .addBearerAuth()               // Adds the "Authorize" button in Swagger UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);   // Swagger UI at http://localhost:3000/api

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

**`ValidationPipe` options explained:**

| Option | Effect |
|--------|--------|
| `whitelist: true` | Body `{ email, password, isAdmin: true }` → strips `isAdmin` silently |
| `transform: true` | Converts plain JS object from JSON into actual DTO class instance |
| `forbidNonWhitelisted: true` | Instead of silently stripping, throws 400 if extra fields present |

**Swagger** auto-generates interactive API docs by reading your controllers and DTOs. Visit `http://localhost:3000/api` after starting the server.

---

## 11. Request Flow — Step by Step

### POST /auth/register

```
1. Client sends:
   POST /auth/register
   Content-Type: application/json
   { "email": "user@example.com", "password": "mypassword123" }

2. NestJS receives request
   → Routes to AuthController.register()

3. ValidationPipe intercepts body
   → Creates RegisterDto instance
   → Runs @IsEmail() on email → passes
   → Runs @MinLength(8) on password → passes
   → Injects validated dto into controller method

4. AuthController calls authService.register(dto)

5. AuthService.register():
   a. Queries DB: SELECT * FROM "User" WHERE email = 'user@example.com'
   b. User not found → continue
   c. bcrypt.hash("mypassword123", 10) → "$2b$10$abc...xyz"
   d. INSERT INTO "User" (id, email, password, createdAt)
      VALUES (uuid(), 'user@example.com', '$2b$10$abc...xyz', now())
   e. jwt.signAsync({ sub: "uuid-123", email: "user@example.com" })
      → "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOi..."

6. Response:
   HTTP 201 Created
   { "access_token": "eyJhbGciOiJIUzI1NiJ9..." }
```

---

### POST /auth/login

```
1. Client sends:
   POST /auth/login
   { "email": "user@example.com", "password": "mypassword123" }

2. ValidationPipe validates LoginDto

3. AuthService.login():
   a. SELECT * FROM "User" WHERE email = 'user@example.com'
   b. User found
   c. bcrypt.compare("mypassword123", "$2b$10$abc...xyz") → true
   d. jwt.signAsync({ sub: "uuid-123", email: "user@example.com" })

4. Response:
   HTTP 200 OK
   { "access_token": "eyJhbGciOiJIUzI1NiJ9..." }
```

---

### Protected Route (future use)

```typescript
// Any future controller:
@Get('profile')
@UseGuards(AuthGuard('jwt'))    // Activates JwtStrategy
getProfile(@Request() req) {
  return req.user               // { userId: "...", email: "..." }
}
```

```
1. Client sends:
   GET /profile
   Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

2. AuthGuard('jwt') activates JwtStrategy
   a. ExtractJwt.fromAuthHeaderAsBearerToken() extracts the token
   b. Verifies signature using JWT_SECRET
   c. Checks expiry
   d. Calls validate({ sub: "uuid-123", email: "user@example.com" })
   e. Returns { userId: "uuid-123", email: "user@example.com" }

3. NestJS sets req.user = { userId: "...", email: "..." }

4. Controller runs, returns req.user

5. If token missing/invalid/expired → 401 Unauthorized (automatic)
```

---

## 12. How to Run

### Prerequisites
- Node.js installed
- PostgreSQL running
- `.env` file configured

### Step 1 — Install dependencies (already done if node_modules exists)
```bash
npm install
```

### Step 2 — Set up the database

Make sure your `.env` has the right `DATABASE_URL`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ecommerce"
```

Run Prisma migration to create tables:
```bash
npx prisma migrate dev --name init
```

This creates the `User`, `Role`, and `UserRole` tables in your database.

### Step 3 — Start the server
```bash
npm run start:dev
```

Server runs at `http://localhost:3000`  
Swagger UI at `http://localhost:3000/api`

### Step 4 — Test the endpoints

**Register:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

Expected response:
```json
{ "access_token": "eyJhbGciOiJIUzI1NiJ9..." }
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

Expected response:
```json
{ "access_token": "eyJhbGciOiJIUzI1NiJ9..." }
```

**Test wrong password:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "wrongpassword"}'
```

Expected response:
```json
{ "statusCode": 401, "message": "Invalid credentials" }
```

---

## Key Packages Summary

| Package | Role |
|---------|------|
| `@nestjs/jwt` | Creates and verifies JWT tokens |
| `@nestjs/passport` | NestJS wrapper for Passport.js auth middleware |
| `passport-jwt` | Passport strategy that handles JWT extraction and verification |
| `bcrypt` | Password hashing (slow by design — prevents brute force) |
| `@prisma/client` | Type-safe database client generated from schema |
| `class-validator` | Decorators like `@IsEmail()`, `@MinLength()` for DTO validation |
| `class-transformer` | Transforms plain objects into class instances (needed by ValidationPipe) |
| `@nestjs/config` | Reads `.env` file, provides `ConfigService` |
| `@nestjs/swagger` | Auto-generates API documentation UI |
