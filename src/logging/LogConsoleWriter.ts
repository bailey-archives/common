import { LogEvent } from './LogEvent';
import { LogLevel } from './LogLevel';
import { LogWriter } from './LogWriter';
import { Action } from '../types/types';
import chalk from 'chalk';

/**
 * This utility class forwards output from `Logger` instances to the console. It will enable color output on all
 * loggers by default unless the logger has been configured with colors specifically set to false.
 */
export class LogConsoleWriter extends LogWriter {

	/**
	 * The color function to use for the timestamp. Defaults to `chalk.gray`.
	 */
	public logTimestampColor: Action<string> = chalk.gray;

	/**
	 * The color function to use for the logger name. Defaults to `chalk.gray`.
	 */
	public logNameColor: Action<string> = chalk.gray;

	/**
	 * Whether or not the logger name should be included in the output.
	 */
	public logNameEnabled = true;

	/**
	 * Whether or not the timestamp should be included in the output.
	 */
	public logTimestampEnabled = true;

	/**
	 * Enables color output.
	 */
	protected _useColor = true;

	/**
	 * Returns the prefix to use for the log event. If no prefix should be used, must return an empty string.
	 *
	 * @param event
	 */
	protected _getLogPrefix(event: LogEvent) {
		const date = new Date(event.timestamp);
		const timestampDate = [
			date.getFullYear(),
			date.getMonth(),
			date.getDate(),
		].join('-');

		const timestampTime = [
			date.getHours(),
			date.getMinutes(),
			date.getSeconds(),
		].join(':');

		const timestampMillis = date.getMilliseconds().toString().padStart(3, '0');
		const timestamp = this.logTimestampColor('[' + timestampDate + ' ' + timestampTime + '.' + timestampMillis + ']');
		const name = this.logNameColor('[' +  event.name + ']');

		let level = '';

		switch (event.level) {
			case LogLevel.Verbose: level = chalk.greenBright('verbose:'); break;
			case LogLevel.Debug: level = chalk.magenta('debug:'); break;
			case LogLevel.Info: level = chalk.cyanBright('info:'); break;
			case LogLevel.Warn: level = chalk.yellowBright('warn:'); break;
			case LogLevel.Error: level = chalk.red('error:'); break;
		}

		const parts = [];

		if (this.logTimestampEnabled) {
			parts.push(timestamp);
		}

		if (this.logNameEnabled) {
			parts.push(name);
		}

		parts.push(level);

		return parts.join(' ') + ' ';
	}

	/**
	 * Writes log output to the destination.
	 *
	 * @param event An object specifying the details of the log message.
	 */
	protected _write(event: LogEvent) {
		// Build the complete log message
		const text = this._getLogPrefix(event) + event.content;

		// Write the message to the console
		switch (event.level) {
			case LogLevel.Error: return console.error(text);
			case LogLevel.Warn: return console.warn(text);
			case LogLevel.Debug:
			case LogLevel.Verbose: return console.debug(text);
			case LogLevel.Info: return console.info(text);
		}

		throw new Error('Unknown log level: ' + event.level);
	}

}
