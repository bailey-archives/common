import { LogEvent } from './LogEvent';
import { LogLevel } from './LogLevel';
import { LogWriter } from './LogWriter';
import { Action } from '../types/types';
import chalk from 'chalk';
import type { InspectOptions } from 'util';

// @ts-ignore
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const util = isBrowser ? null : require('util');

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
	 * The options to use when formatting log output. Node only.
	 */
	public options: InspectOptions = {
		colors: true
	};

	/**
	 * Returns the prefix to use for the log event. If no prefix should be used, must return an empty string.
	 *
	 * @param event
	 */
	protected _getLogPrefix(event: LogEvent) {
		const date = new Date(event.timestamp);
		const timestampDate = [
			date.getFullYear(),
			date.getMonth().toString().padStart(2, '0'),
			date.getDate().toString().padStart(2, '0'),
		].join('-');

		const timestampTime = [
			date.getHours().toString().padStart(2, '0'),
			date.getMinutes().toString().padStart(2, '0'),
			date.getSeconds().toString().padStart(2, '0'),
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
		if (isBrowser) {
			const prefix = this._getLogPrefix(event);

			if (typeof event.args[0] === 'string') {
				event.args[0] = prefix + event.args[0];
			}

			// Write the message to the console
			switch (event.level) {
				case LogLevel.Error: return console.error(...event.args);
				case LogLevel.Warn: return console.warn(...event.args);
				case LogLevel.Debug:
				case LogLevel.Verbose: return console.debug(...event.args);
				case LogLevel.Info: return console.info(...event.args);
			}

			throw new Error('Unknown log level: ' + event.level);
		}

		// Build the complete log message
		const content = util.formatWithOptions(this.options, ...event.args);
		const text = this._getLogPrefix(event) + content;

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
