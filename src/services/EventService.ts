import { singleton } from 'tsyringe';
import { Event, APIEvent } from '../entities/Event';
import { getRepository, getConnection } from 'typeorm';
import { validateOrReject } from 'class-validator';
import { EventChannel } from '../entities/Channel';
import { formatValidationErrors, APIError, HttpCode } from '../util/errors';
import sharp from 'sharp';
import { writeFile as _writeFile, unlink as _unlink } from 'fs';
import { promisify } from 'util';
import { v4 } from 'uuid';

const writeFile = promisify(_writeFile);
const unlink = promisify(_unlink);

type EventCreationData = Omit<APIEvent, 'id' | 'channelID' | 'image'> & { image: string|boolean };

enum PatchEventError {
	IdMissing = 'Event ID missing',
	EventNotFound = 'Event does not exist',
	InvalidImage = 'File must be an image.'
}

@singleton()
export default class EventService {
	public async uploadImage(image: string|boolean, event: Event, file?: Express.Multer.File): Promise<Event> {
		const unsetImage = typeof image === 'boolean' ? !image : image === 'false';

		// If there is an image, try to process it
		let processedImage: Buffer|undefined;
		if (!unsetImage && file?.buffer && file.buffer.length > 0) {
			processedImage = await sharp(file.buffer)
				.resize({ width: 1200 })
				.png()
				.toBuffer()
				.catch(() => Promise.reject(new APIError(HttpCode.BadRequest, PatchEventError.InvalidImage)));
			event.image = true;
		} else if (unsetImage) {
			await unlink(`./assets/${event.id}.png`).catch(() => Promise.resolve());
			event.image = false;
		}

		if (processedImage) {
			await writeFile(`./assets/${event.id}.png`, processedImage);
		}
		return event;
	}


	public async createEvent(data: EventCreationData, file?: Express.Multer.File): Promise<APIEvent> {
		const event = new Event();
		// If a file is attached, then an ID must be generated before saving the asset
		if (file) event.id = v4();
		const { title, description, startTime, endTime, external } = data;
		Object.assign(event, { title, description, startTime: new Date(startTime), endTime: new Date(endTime), external });
		await validateOrReject(event).catch(e => Promise.reject(formatValidationErrors(e)));
		const channel = new EventChannel();
		channel.event = event;
		event.channel = channel;

		event.image = (await this.uploadImage(data.image, event, file)).image;

		return (await getRepository(Event).save(event)).toJSON();
	}

	public async findAll(): Promise<APIEvent[]> {
		return (await getRepository(Event).find()).map(event => event.toJSON());
	}

	public async editEvent(data: Pick<APIEvent, 'id'> & Partial<APIEvent> & { image: string|boolean }, file?: Express.Multer.File): Promise<APIEvent> {
		return getConnection().transaction(async entityManager => {
			if (!data.id) throw new APIError(HttpCode.BadRequest, PatchEventError.IdMissing);
			const event = await entityManager.findOneOrFail(Event, data.id).catch(() => Promise.reject(new APIError(HttpCode.BadRequest, PatchEventError.EventNotFound)));
			if (data.startTime) (data as any).startTime = new Date(data.startTime);
			if (data.endTime) (data as any).endTime = new Date(data.endTime);
			Object.assign(event, { ...data, image: event.image, channel: event.channel });
			await validateOrReject(event).catch(e => Promise.reject(formatValidationErrors(e)));

			event.image = (await this.uploadImage(data.image, event, file)).image;

			return (await entityManager.save(event)).toJSON();
		});
	}
}
