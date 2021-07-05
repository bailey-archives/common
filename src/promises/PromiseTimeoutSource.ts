import { Action } from '../types/types';
import { PromiseCompletionSource } from './PromiseCompletionSource';

/**
 * This utility class schedules an `action` to run after a specific number of `milliseconds` using a timeout. It also
 * provides a method to cancel the timeout before it is invoked.
 *
 * The most common use case for this utility is to implement timeouts on an operation which should be cancelled when
 * the operation completes.
 */
 export class PromiseTimeoutSource {

	private _source: PromiseCompletionSource<boolean>;
	private _timeout: NodeJS.Timeout;

	private _isFinished = false;
	private _isCancelled = false;

	public constructor(public readonly milliseconds: number, public readonly action: Action) {
		this._source = new PromiseCompletionSource();
		this._timeout = setTimeout(() => this._execute(), milliseconds);
	}

	/**
	 * A promise which resolves when this timeout is finished. Resolves with `true` if the action was invoked or
	 * `false` if the action was cancelled. Rejects with an error if the action is invoked but throws unexpectedly.
	 */
	public get promise() {
		return this._source.promise;
	}

	/**
	 * Internal executor for the timeout.
	 */
	private async _execute() {
		try {
			await Promise.resolve(this.action());
			this._source.setResult(true);
		}
		catch (err) {
			this._source.setError(err);
		}
	}

	/**
	 * Cancels the timeout. The promise will resolve with `false`.
	 */
	public cancel() {
		if (!this._source.isFinished) {
			this._isCancelled = true;
			this._source.setResult(false);
			clearTimeout(this._timeout);
		}
	}

	/**
	 * Whether or not the timeout has finished or been cancelled.
	 */
	public get isFinished() {
		return this._isFinished;
	}

	/**
	 * Whether or not the timeout is still pending invocation.
	 */
	public get isPending() {
		return !this._isFinished;
	}

	/**
	 * Whether or not the timeout was cancelled before it executed.
	 */
	public get isCancelled() {
		return this._isCancelled;
	}

}
