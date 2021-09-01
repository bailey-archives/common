import { Lifecycle } from '../Container';
import { resolver } from '../ContainerResolver'
import { Type } from '../../types/types'
import { Injectable } from './Injectable';

/**
 * This decorator registers a class as a singleton in the global container instance. If a container name is
 * provided, then it will be registered on the specified named container instead.
 */
export function Singleton(constructor: Type<any>): void;
export function Singleton(): (constructor: Type<any>) => void;
export function Singleton(containerName: string): (constructor: Type<any>) => void;
export function Singleton(nameOrConstructor?: Type<any> | string) {
	if (typeof nameOrConstructor === 'function') {
		resolver.getGlobalInstance().register(
			nameOrConstructor,
			{ useClass: nameOrConstructor },
			{ lifecycle: Lifecycle.Singleton }
		);

		Injectable(nameOrConstructor);

		return;
	}

	return function (constructor: Type<any>) {
		const container = (typeof nameOrConstructor === 'string') ?
			resolver.getInstance(nameOrConstructor) :
			resolver.getGlobalInstance();

		container.register(
			constructor,
			{ useClass: constructor },
			{ lifecycle: Lifecycle.Singleton }
		);

		Injectable(constructor);
	}
}
