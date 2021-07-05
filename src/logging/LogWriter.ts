import { Action } from '../types/types';
import { LogEvent } from './LogEvent';
import { Logger } from './Logger';
import { LogLevel } from './LogLevel';

/**
 * This base utility class can be extended to build your own custom writer for handling log output.
 */
export abstract class LogWriter {

	private _actions = new Map<Logger, Action<void>>();

	/**
	 * Enables color output on newly mounted loggers.
	 */
	protected _useColor = false;

	/**
	 * Constructs a new `ConsoleWriter` instance.
	 *
	 * @param logLevel Specifies the target logging level to write. Any output below this level will be ignored.
	 */
	public constructor(public logLevel: LogLevel = LogLevel.Info) {

	}

	/**
	 * Mounts the given logger to the writer. All future output from the logger will be written.
	 *
	 * @param logger
	 */
	public mount(logger: Logger) {
		if (!this._actions.has(logger)) {
			const action = (event: LogEvent) => this._execute(event);
			this._actions.set(logger, action);
			logger.on('log', action);

			if (this._useColor && logger.options.colors === undefined) {
				logger.options.colors = true;
			}
		}
	}

	/**
	 * Dismounts the given logger from the writer.
	 *
	 * @param logger
	 */
	public dismount(logger: Logger) {
		if (this._actions.has(logger)) {
			const action = this._actions.get(logger)!;
			this._actions.delete(logger);
			logger.removeListener('log', action);
		}
	}

	/**
	 * Executes the given log event.
	 *
	 * @param event
	 */
	private _execute(event: LogEvent) {
		if (event.level >= this.logLevel) {
			this._write(event.level, this._format(event));
		}
	}

	/**
	 * Formats log output into a single string for writing.
	 *
	 * @param event
	 */
	protected _format(event: LogEvent): string {
		return this._getLogPrefix(event) + event.content;
	}

	/**
	 * Returns the prefix to use for the log event. If no prefix should be used, must return an empty string.
	 *
	 * @param event
	 */
	protected _getLogPrefix(event: LogEvent): string {
		return '';
	}

	/**
	 * Writes log output to the destination.
	 *
	 * @param level
	 * @param text
	 */
	 protected abstract _write(level: LogLevel, text: string): void | Promise<void>;

}