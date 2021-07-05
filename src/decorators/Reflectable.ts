import { Action } from '../types/types';

/**
 * This is a blank decorator that can be applied to classes or methods to trigger metadata emit.
 *
 * @returns
 */
export function Reflectable(): Action {
	return function() {};
}
