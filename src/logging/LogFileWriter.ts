import { LogEvent } from './LogEvent';
import { LogLevel } from './LogLevel';
import { LogWriter } from './LogWriter';
import fs, { WriteStream } from 'fs';
import path from 'path';
import util from 'util';
import { EOL } from 'os';

/**
 * This utility class forwards output from `Logger` instances to a file.
 */
export class LogFileWriter extends LogWriter {

	protected _stream: WriteStream;
	protected _logFileSize = 0;

	protected _paused = false;
	protected _queue = new Array<LogEvent>();

	public constructor(public options: LogFileWriterOptions) {
		super(options.logLevel);
		this._stream = this._openFileStream();
		this._readFileSize();
	}

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
		const timestamp = '[' + timestampDate + ' ' + timestampTime + '.' + timestampMillis + ']';
		const name = '[' +  event.name + ']';

		let level = '';

		switch (event.level) {
			case LogLevel.Verbose: level = 'verbose:'; break;
			case LogLevel.Debug: level = 'debug:'; break;
			case LogLevel.Info: level = 'info:'; break;
			case LogLevel.Warn: level = 'warn:'; break;
			case LogLevel.Error: level = 'error:'; break;
		}

		const parts = [];

		if (this.options.logTimestampEnabled ?? true) {
			parts.push(timestamp);
		}

		if (this.options.logNameEnabled ?? true) {
			parts.push(name);
		}

		parts.push(level);

		return parts.join(' ') + ' ';
	}

	/**
	 * Writes log output to the destination file.
	 *
	 * @param event
	 */
	protected _write(event: LogEvent): void {
		if (this._paused) {
			this._queue.push(event);
			return;
		}

		const content = util.formatWithOptions(this.options.formatOptions ?? {}, ...event.args);
		const text = this._getLogPrefix(event) + content + (this.options.formatEOL ?? EOL);

		// Calculate the new log size
		this._logFileSize += text.length;
		const rotateAfter = this.options.logRotationSize ?? 52428800;

		// Write with log rotation
		if (rotateAfter > 0 && this._logFileSize >= rotateAfter) {
			this._rotate(text);
		}

		// Write directly to the stream
		else {
			this._stream.write(text);
		}
	}

	/**
	 * Rotates the log file if necessary.
	 */
	protected _rotate(text: string) {
		const originalFileName = path.resolve(this.fileName);
		const rotationDir = path.resolve(this.options.logRotationDir ?? path.dirname(this.fileName));
		const nextRotationNumber = this._getRotationFileCount(rotationDir) + 1;
		const fileName = path.resolve(rotationDir, path.basename(this.fileName) + '.' + nextRotationNumber);
		const stream = this._stream;

		// Pause writing
		this._paused = true;

		// Handle the finish event
		stream.once('finish', () => {
			console.log('Rotate:', {
				rotationDir,
				nextRotationNumber,
				fileName
			});

			// Ensure the dir exists
			if (!fs.existsSync(rotationDir)) {
				fs.mkdirSync(rotationDir, { recursive: true });
			}

			// Move the file
			fs.renameSync(originalFileName, fileName);

			// Create a new stream
			this._stream = this._openFileStream();
			this._logFileSize = 0;

			// Unpause writing
			this._paused = false;

			// Run through queue items
			let event: LogEvent | undefined;
			while (event = this._queue.shift()) {
				this._write(event);
			}
		});

		// Write the last chunk
		stream.end(text);
	}

	/**
	 * Returns the largest suffix number among all rotated log files. In general, this is the rotated log file
	 * count.
	 *
	 * @param dir
	 * @returns
	 */
	protected _getRotationFileCount(dir: string) {
		try {
			const files = fs.readdirSync(dir);
			const prefix = path.basename(this.fileName) + '.';

			let largestNumber = 0;

			for (const file of files) {
				if (file.startsWith(prefix)) {
					const suffix = file.substring(prefix.length);

					if (suffix.match(/^\d+$/)) {
						const number = +suffix;

						if (number > largestNumber) {
							largestNumber = number;
						}
					}
				}
			}

			return largestNumber;
		}
		catch (_) {
			return 0;
		}
	}

	/**
	 * Opens a write stream for the target log file.
	 */
	protected _openFileStream() {
		return fs.createWriteStream(this.fileName, {
			flags: 'a+',
			encoding: this.options.encoding
		})
	}

	/**
	 * Reads the file size from the disk.
	 */
	protected _readFileSize() {
		try {
			const stat = fs.statSync(this.fileName);
			this._logFileSize = stat.size;
		}
		catch (_) {}
	}

	public get fileName() {
		return this.options.fileName ?? 'console.log';
	}

}

export interface LogFileWriterOptions {
	/**
	 * The file name or absolute path to the log file.
	 */
	fileName?: string;

	/**
	 * The minimum log level to record.
	 */
	logLevel?: LogLevel;

	/**
	 * The encoding to use for the log file. Defaults to `utf8`.
	 */
	encoding?: BufferEncoding;

	/**
	 * Options for formatter customization.
	 */
	formatOptions?: util.InspectOptions;

	/**
	 * The newline character to use. Defaults to the EOL for the current operating system.
	 */
	formatEOL?: string;

	/**
	 * The log file will be rotated after reaching this number of bytes. Set to `0` to disable rotation.
	 * Defaults to `52428800` (50 MiB).
	 */
	logRotationSize?: number;

	/**
	 * The directory to store rotated log files in. Defaults to the same directory as the `fileName`.
	 */
	logRotationDir?: string;

	/**
	 * Whether or not the logger name should be included in the output. Defaults to `true`.
	 */
	logNameEnabled?: boolean;

	/**
	 * Whether or not the timestamp should be included in the output. Defaults to `true`.
	 */
	logTimestampEnabled?: boolean;
}
