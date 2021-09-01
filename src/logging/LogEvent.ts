import { LogLevel } from './LogLevel';

export interface LogEvent {
	/**
	 * The level of this log entry.
	 */
	level: LogLevel;

	/**
	 * The name of the logger which sent this event. This can be used to discern which part of the code base a log
	 * entry originated from.
	 */
	name: string;

	/**
	 * The original timestamp at which this log event was dispatched.
	 */
	timestamp: number;

	/**
	 * The message content of the log event as the original argument array.
	 */
	args: any[];
}
