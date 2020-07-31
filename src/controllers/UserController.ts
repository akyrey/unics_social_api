import { UserService } from '../services/UserService';
import { NextFunction, Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import EmailService from '../services/email/EmailService';
import { VerifyEmailTemplate } from '../util/emails';
import { generateJWT } from '../util/auth';
import { AuthenticatedResponse } from '../routes/middleware/getUser';
import { APIError, HttpCode } from '../util/errors';
/*
	to-do:
	improve error handling, use more enums, do not expose raw errors to enduser
*/

enum GetUserError {
	UserNotFound = 'User not found',
}

@injectable()
export class UserController {
	private readonly userService: UserService;
	private readonly emailService: EmailService;

	public constructor(@inject(UserService) _userService: UserService, @inject(EmailService) _emailService: EmailService) {
		this.userService = _userService;
		this.emailService = _emailService;
	}

	public async registerUser(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const confirmation = await this.userService.registerUser(req.body);
			await this.emailService.sendEmail({
				to: confirmation.user.email,
				subject: 'Verify your UniCS KB email',
				html: VerifyEmailTemplate(confirmation.user.forename, confirmation.id)
			});
			res.status(HttpCode.NoContent).end();
		} catch (error) {
			next(error);
		}
	}

	public async verifyUserEmail(req: Request & { query: { confirmationId: string } }, res: Response, next: NextFunction): Promise<void> {
		try {
			await this.userService.verifyUserEmail(req.query.confirmationId);
			res.status(HttpCode.NoContent).end();
		} catch (error) {
			next(error);
		}
	}

	public async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const user = await this.userService.authenticate(req.body.email, req.body.password);
			const token = await generateJWT(user);
			res.json({ token });
		} catch (error) {
			next(error);
		}
	}

	public async getUser(req: Request & { params: { id: string } }, res: AuthenticatedResponse, next: NextFunction): Promise<void> {
		try {
			if (!req.params.id) throw new APIError(HttpCode.NotFound, GetUserError.UserNotFound);
			if (req.params.id === '@me') req.params.id = res.locals.user.id;
			const user = await this.userService.findOne({ id: req.params.id });
			if (!user) throw new APIError(HttpCode.NotFound, GetUserError.UserNotFound);
			res.json({
				user: user.toLimitedJSON()
			});
		} catch (error) {
			next(error);
		}
	}

	public async putUserProfile(req: Request, res: AuthenticatedResponse, next: NextFunction): Promise<void> {
		try {
			const user = await this.userService.putUserProfile(res.locals.user.id, req.body);
			res.json({ user });
		} catch (error) {
			next(error);
		}
	}
}
