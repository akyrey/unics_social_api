import { PrimaryGeneratedColumn, Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { MaxLength, IsString, IsDate } from 'class-validator';
import { EventChannel } from './Channel';

export interface APIEvent {
	id: string;
	title: string;
	startTime: string;
	endTime: string;
	description: string;
	external: string;
	channelID: string;
}

@Entity()
export class Event {
	@PrimaryGeneratedColumn('uuid')
	public id!: string;

	@Column()
	@IsString()
	@MaxLength(50, { message: 'An event title must be 50 characters at most' })
	public title!: string;

	@Column('timestamp')
	@IsDate()
	public startTime!: Date;

	@Column('timestamp')
	@IsDate()
	public endTime!: Date;

	@Column()
	@IsString()
	@MaxLength(2000, { message: 'An event description must be 2000 characters at most' })
	public description!: string;

	@Column()
	@IsString()
	public external!: string;

	@OneToOne(() => EventChannel, channel => channel.event, { nullable: true, eager: true, cascade: true })
	@JoinColumn()
	public channel!: EventChannel;

	public toJSON(): APIEvent {
		const { id, title, startTime, endTime, description, external, channel } = this;
		return {
			id,
			title,
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			description,
			external,
			channelID: channel.id
		};
	}
}
