/**
 * This utility class allows you to create a `Promise` instance and then either resolve or reject it using the
 * `setResult()` and `setError()` methods.
 */
 export class PromiseCompletionSource<T> {

	private _promise: Promise<T>;
	private _resolve: (value: T) => void;
	private _reject: (err?: any) => void;

	private _isFinished = false;
	private _isResolved = false;
	private _isRejected = false;

	/**
	 * Constructs a new `PromiseCompletionSource<T>` instance.
	 */
	public constructor() {
		this._resolve = () => {};
		this._reject = () => {};
		this._promise = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	/**
	 * The underlying promise that can be awaited.
	 */
	public get promise() {
		return this._promise;
	}

	/**
	 * Returns `true` when the promise source has either resolved or rejected.
	 */
	public get isFinished() {
		return this._isFinished;
	}

	/**
	 * Returns `true` if the promise resolved successfully.
	 */
	public get isResolved() {
		return this._isResolved;
	}

	/**
	 * Returns `true` if the promise rejected.
	 */
	public get isError() {
		return this._isRejected;
	}

	/**
	 * Resolves the promise with the provided value.
	 *
	 * @param value
	 */
	public setResult(value: T) {
		if (!this._isFinished) {
			this._isFinished = true;
			this._isResolved = true;

			this._resolve(value);
		}
	}

	/**
	 * Rejects the promise, optionally with the given error.
	 *
	 * @param err
	 */
	public setError(err?: any) {
		if (!this._isFinished) {
			this._isFinished = true;
			this._isRejected = true;

			this._reject(err);
		}
	}

}
