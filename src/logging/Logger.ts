import { EventEmitter } from '../events/EventEmitter';
import { LogEvent } from './LogEvent';
import { LogLevel } from './LogLevel';
import util from 'util';

/**
 * This utility class allows you to create loggers which support various log levels. The arguments and formatting
 * behavior matches the `console` logging functions.
 *
 * Loggers can be independent, or they can be spawned as children of other loggers. Child loggers will pass their
 * log output to their parents until it reaches the root logger where output can be written to a custom destination.
 *
 * This class does not print anything! Use the `log` event to listen for data, or use the `LogConsoleWriter` utility
 * class to write logs to the console.
 */
export class Logger extends EventEmitter<Events> {

	/**
	 * The options to use when formatting log output.
	 */
	public options: util.InspectOptions = {};

	public constructor(protected name: string = 'app', protected parent?: Logger) {
		super();

		// Inherit from the parent if applicable
		if (parent !== undefined) {
			this.options = parent.options;
			this.on('log', event => parent._emit('log', event));
		}
	}

	/**
	 * Creates a new child `Logger` instance that inherits options from and forwards events up to this logger.
	 *
	 * @param name
	 * @returns
	 */
	public createLogger(name: string) {
		return new Logger(name, this);
	}

	public verbose(...args: any[]) {
		return this.writeLine(LogLevel.Verbose, ...args);
	}

	public debug(...args: any[]) {
		return this.writeLine(LogLevel.Debug, ...args);
	}

	public info(...args: any[]) {
		return this.writeLine(LogLevel.Info, ...args);
	}

	public warn(...args: any[]) {
		return this.writeLine(LogLevel.Warn, ...args);
	}

	public error(...args: any[]) {
		return this.writeLine(LogLevel.Error, ...args);
	}

	protected writeLine(level: LogLevel, ...args: any[]) {
		this._emit('log', {
			level,
			name: this.name,
			timestamp: Date.now(),
			content: util.formatWithOptions(this.options, ...args)
		});
	}

}

type Events = {
	log: [event: LogEvent];
};

