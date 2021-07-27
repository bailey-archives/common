import { EventEmitter } from '../../events/EventEmitter';
import cp, { ChildProcess } from 'child_process';
import fs from 'fs';

/**
 * This helper class provides an interface for working with command line tools.
 */
export class Command extends EventEmitter<Events> {

	private _arguments = new Set<IArgument>();

	/**
	 * Current working directory of the child process.
	 */
	public cwd?: string;

	/**
	 * Environment key-value pairs. Defaults to `process.env`.
	 */
	public env?: { [name: string]: string };

	/**
	 * Explicitly set the value of `argv[0]` sent to the child process. This will be set to `name` if not specified.
	 */
	public argv0?: string;

	/**
	 * Prepare child to run independently of its parent process. Specific behavior depends on the platform.
	 *
	 * On Windows, setting `detached` to true makes it possible for the child process to continue running after the
	 * parent exits. The child will have its own console window. Once enabled for a child process, it cannot be
	 * disabled.
	 *
	 * On non-Windows platforms, if `detached` is set to true, the child process will be made the leader of a new
	 * process group and session. Child processes may continue running after the parent exits regardless of whether
	 * they are detached or not.
	 *
	 * By default, the parent will wait for the detached child to exit. To prevent the parent from waiting for a given
	 * subprocess to exit, use the `subprocess.unref()` method. Doing so will cause the parent's event loop to not
	 * include the child in its reference count, allowing the parent to exit independently of the child, unless there
	 * is an established IPC channel between the child and the parent.
	 *
	 * When using the detached option to start a long-running process, the process will not stay running in the
	 * background after the parent exits unless it is provided with a stdio configuration that is not connected to
	 * the parent. If the parent's stdio is inherited, the child will remain attached to the controlling terminal.
	 */
	public detached?: boolean;

	/**
	 * Sets the user identity of the process.
	 */
	public uid?: number;

	/**
	 * Sets the group identity of the process.
	 */
	public gid?: number;

	/**
	 * If `true`, runs `name` inside of a shell. Uses `'/bin/sh'` on Unix, and `process.env.ComSpec` on Windows. A
	 * different shell can be specified as a string. Defaults to `false` (no shell).
	 */
	public shell?: boolean;

	/**
	 * No quoting or escaping of arguments is done on Windows. Ignored on Unix. This is set to `true` automatically
	 * when `shell` is specified and is CMD. Defaults to `false`.
	 */
	public windowsVerbatimArguments?: boolean;

	/**
	 * Hide the subprocess console window that would normally be created on Windows systems. Defaults to `false`.
	 */
	public windowsHide?: boolean;

	/**
	 * In milliseconds the maximum amount of time the process is allowed to run. Defaults to `undefined`.
	 */
	public timeout?: number;

	/**
	 * The default signal value to be used when the spawned process is killed.
	 */
	public killSignal?: NodeJS.Signals;

	/**
	 * When enabled, the command will store all output internally. After the command finishes running, you can use the
	 * `getLog()` or `writeLog(fileName)` methods to consume the internal output log.
	 */
	public logging = false;

	private _process?: ChildProcess;
	private _log = new Array<Buffer>();

	/**
	 * Constructs a new `Command` instance.
	 *
	 * @param name The name or path of the binary file
	 */
	public constructor(public readonly name: string) {
		super();
	}

	/**
	 * Sets an option on the command line.
	 *
	 * **Example:** `--name value`.
	 *
	 * @param name
	 * @param value
	 */
	public setOption(name: string, value: string | number) {
		this._arguments.add({
			type: IArgumentType.Option,
			name,
			value: value.toString()
		});
	}

	/**
	 * Adds the specified flag on the command line.
	 *
	 * **Example:** `--name`.
	 *
	 * @param name
	 */
	public setFlag(name: string) {
		this._arguments.add({
			type: IArgumentType.Flag,
			name
		});
	}

	/**
	 * Adds a generic parameter on the command line.
	 *
	 * @param value
	 */
	public setParameter(value: string | number) {
		this._arguments.add({
			type: IArgumentType.Parameter,
			value: value.toString()
		});
	}

	/**
	 * Executes the command and returns a promise which resolves with the exit code once it is completed. If there is
	 * an error starting the command, the promise will reject.
	 */
	public execute() {
		return new Promise<number>((resolve, reject) => {
			if (this._process) {
				return reject(new Error('Cannot execute command more than once'));
			}

			let spawned = false;
			let exited = false;
			let errored = false;

			const proc = this._process = this._spawn();

			// Handle errors
			proc.on('error', err => {
				this._emit('error', err);

				if (!spawned && !errored && !exited) {
					errored = true;
					reject(err);
				}
			});

			// Handle exits
			proc.on('exit', (code, signal) => {
				if (!exited) {
					exited = true;
					this._emit('exit', code ?? 0, signal);
					resolve(code ?? 0);

					proc.removeAllListeners();
				}
			});

			// Handle spawns
			proc.once('spawn', () => {
				spawned = true;
			});

			// Bind to output
			this._bind(proc);
		});
	}

	/**
	 * Kills the process.
	 *
	 * @param signal The optional kill signal to use.
	 */
	public kill(signal?: NodeJS.Signals) {
		this._process?.kill(signal ?? this.killSignal);
	}

	/**
	 * The exit code of the process or `undefined` if still running.
	 */
	public get exitCode() {
		return this._process?.exitCode ?? undefined;
	}

	/**
	 * The process identifier or `undefined` if not running.
	 */
	public get pid() {
		return this._process?.pid;
	}

	/**
	 * Writes data into the `stdin` pipe.
	 *
	 * @param chunk
	 */
	public write(chunk: string | Buffer | Uint8Array) {
		return new Promise<void>((resolve, reject) => {
			this._process?.stdin?.write(chunk, err => err ? reject(err) : resolve());
		});
	}

	/**
	 * Compiles arguments into an array for spawning the child process.
	 */
	private _compile() {
		const args = new Array<string>();

		for (const argument of this._arguments) {
			if (argument.type === IArgumentType.Flag) {
				const prefix = argument.name.startsWith('-') ? '' : '--';
				args.push(prefix + argument.name);
			}
			else if (argument.type === IArgumentType.Option) {
				const prefix = argument.name.startsWith('-') ? '' : '--';
				args.push(prefix + argument.name);
				args.push(argument.value);
			}
			else {
				args.push(argument.value);
			}
		}

		return args;
	}

	/**
	 * Spawns and returns the child process.
	 */
	private _spawn() {
		return cp.spawn(this.name, this._compile(), {
			cwd: this.cwd,
			env: this.env,
			argv0: this.argv0,
			detached: this.detached,
			uid: this.uid,
			gid: this.gid,
			shell: this.shell,
			windowsVerbatimArguments: this.windowsVerbatimArguments,
			windowsHide: this.windowsHide,
			timeout: this.timeout
		});
	}

	/**
	 * Binds to the output streams of the given process.
	 *
	 * @param proc
	 */
	private _bind(proc: cp.ChildProcessWithoutNullStreams) {
		proc.stdout.on('data', (chunk: Buffer) => {
			if (this.logging) {
				this._log.push(chunk);
			}

			this._emit('stdout', chunk);
			this._emit('output', chunk);
		});

		proc.stderr.on('data', (chunk: Buffer) => {
			if (this.logging) {
				this._log.push(chunk);
			}

			this._emit('stderr', chunk);
			this._emit('output', chunk);
		});
	}

	/**
	 * Returns the full command output as a `Buffer`. Only applicable if `logging` is enabled on the command before and
	 * during its execution.
	 */
	public getLog() {
		return Buffer.concat(this._log);
	}

	/**
	 * Asynchronously writes the full command output log to the specified file. Only applicable if `logging` is enabled
	 * on the command before and during its execution.
	 */
	public async writeLog(fileName: string) {
		const file = fs.createWriteStream(fileName);

		for (const chunk of this._log) {
			await new Promise<void>((resolve, reject) => {
				file.write(chunk, err => {
					err ? reject(err) : resolve();
				});
			});
		}

		file.close();
	}

	/**
	 * Clears the internal command output log. Only applicable if `logging` is enabled on the command before and during
	 * its execution.
	 */
	public clearLog() {
		this._log = [];
	}

}

type IArgument = IArgumentFlag | IArgumentOption | IArgumentParameter;

interface IArgumentFlag {
	type: IArgumentType.Flag;
	name: string;
}

interface IArgumentOption {
	type: IArgumentType.Option;
	name: string;
	value: string;
}

interface IArgumentParameter {
	type: IArgumentType.Parameter;
	value: string;
}

enum IArgumentType {
	Flag,
	Option,
	Parameter
}

type Events = {
	stdout: [data: Buffer];
	stderr: [data: Buffer];
	output: [data: Buffer];
	exit: [code: number, signal: NodeJS.Signals | null];
	error: [error: Error];
}
