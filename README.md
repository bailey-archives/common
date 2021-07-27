# Common

This package contains several small classes, utilities, types, and polyfills that I use across most of my projects.

```
npm install @baileyherbert/common
```

---

- [Dependency Injection](#dependency-injection)
	- [`Container`](#container)
- [Events](#events)
	- [`EventEmitter`](#eventemitter)
- [Logging](#logging)
	- [`Logger`](#logger)
	- [`LogConsoleWriter`](#logconsolewriter)
- [Polyfills](#polyfills)
	- [`Buffer`](#buffer)
- [Promises](#promises)
	- [`PromiseCompletionSource`](#promisecompletionsource)
	- [`PromiseTimeoutSource`](#promisetimeoutsource)
- [Reflection](#reflection)
	- [`ReflectionClass`](#reflectionclass)
	- [`ReflectionMethod`](#reflectionmethod)
- [Native](#native)
	- [`Command`](#command)
- [Decorators](#decorators)
	- [`@Reflectable`](#reflectable)
	- [`@Resolvable`](#resolvable)
- [Types](#types)
	- [`Json`](#json)
	- [`Key<T>`](#keyt)
	- [`Value<T, K, F>`](#valuet-k-f)
	- [`Fallback<T, F>`](#fallbackt-f)
	- [`Promisable<T>`](#promisablet)
	- [`Type<T>`](#typet)
	- [`Action<T>`](#actiont)

---

## Dependency Injection

### `Container`

This is a simple container used to create and cache singletons with automatic dependency injection.

```ts
import { Container } from '@baileyherbert/common';

// Create a container
// Generally you want a single container for an entire application
const container = new Container();

// Register objects that can be injected based on type when classes need them
container.register(new Dependency());

// Create singletons with dependency injection
// This instance will be cached and reused for future calls
const instance = container.singleton(ClassType);

// Create new instances with dependency injection
// These instances are always fresh and never cached
const instance = container.make(ClassType);
```

---

## Events

### `EventEmitter`

This is an alternative event emitter that works on all platforms. It allows you to specify the event types, and keeps
the `_emit` method protected.

```ts
import { EventEmitter } from '@baileyherbert/common';

export class Chat extends EventEmitter<Events> {

	protected _onUserConnected(user: User) {
		this._emit('connected', user.username);
	}

}

type Events = {
	chat: [username: string, message: string];
	connected: [username: string];
	disconnected: [username: string];
};
```

```ts
const chat = new Chat();

chat.on('connected', username => {
	console.log('User %s connected.', username);
});
```

---

## Logging

### `Logger`

This class creates a logger for a named service or component. It accepts the same arguments as `console.log()`, and
formats data the same way. Instead of sending output to `stdout`, this class emits log output via the `log` event.

```ts
import { Logger } from '@baileyherbert/common';

const logger = new Logger('app');

logger.on('log', event => {
	console.log(event.output);
});

logger.info('Hello world!');
logger.verbose('It works!');
```

Loggers can also spawn children for subcomponents. Their log output is forwarded back up to the root logger, so only
a single listener is required.

```ts
const child = logger.createLogger('child');
child.info('This is from a child logger!');
```

### `LogConsoleWriter`

This class can be used to print logger output to the console with colors, timestamps, and service names.

```ts
import { Logger, LogConsoleWriter } from '@baileyherbert/common';

// Create the logger
const logger = new Logger();

// Create the log console writer with verbosity set to 0 (verbose)
const writer = new LogConsoleWriter(0);

// Mount the logger to the writer
// This immediately starts printing output to the console
writer.mount(logger);
```

---

## Polyfills

### `Buffer`

This class provides the same interface as Node's `Buffer`, but it works in browsers as well. When importing this class,
it will always return Node's native implementation if available.

```ts
import { Buffer } from '@baileyherbert/common';

const buffer = Buffer.from('Hello world!', 'utf8');
const hex = buffer.toString('hex');
```

---

## Promises

### `PromiseCompletionSource`

This class allows you to create a `Promise` which can easily be resolved or rejected on demand from the outside.

```ts
import { PromiseCompletionSource } from '@baileyherbert/common';

function runFakeTask() {
	const source = new PromiseCompletionSource();

	// Resolves the promise after 5 seconds
	setTimeout(() => {
		source.setResult();
	}, 5000);

	// Returns the promise object
	return source.promise;
}

// Resolves after 5 seconds
await runFakeTask();
```

### `PromiseTimeoutSource`

This class creates a promise that resolves to a boolean after the specified time, but can be cancelled prematurely. The boolean is `true` if the timeout was triggered, or `false` if cancelled.

You can also specify a custom `action` to execute when the timeout is reached.

```ts
import { PromiseTimeoutSource } from '@baileyherbert/common';
```

**Example 1:** Pause for 30 seconds

```ts
await new PromiseTimeoutSource(30000);
```

**Example 2:** Run a task after 30 seconds

```ts
new PromiseTimeoutSource(30000, () => {
	console.log('This runs after 30 seconds!');
});
```

**Example 3:** Run a task after 30 seconds (with early cancellation)

```ts
const timeout = new PromiseTimeoutSource(30000, () => {
	console.log('This runs after 30 seconds!');
});

// The action will never run because it gets cancelled after 15 sec!
setTimeout(() => timeout.cancel(), 15000);

// Confirm that it was cancelled
const result = await timeout;
console.log('The timeout was', result ? 'fulfilled' : 'cancelled');
```

---

## Reflection

### `ReflectionClass`

This class is used to retrieve the methods and metadata of a class at runtime.

Reflection can see all methods on a class, but if you want to query its return or parameter types, you'll need to apply
a decorator to it. If you don't have a decorator, use the built-in `@Reflectable()` decorator.

Here's an example class:

```ts
import { Reflectable } from '@baileyherbert/common';

class Test {
	@Reflectable()
	public printHello(name = 'world') {
		console.log('Hello', name);
	}
}
```

We'll query its own local (non-static) methods below and print their names and parameters.

```ts
import { ReflectionClass, MethodFilter } from '@baileyherbert/common';

const ref = new ReflectionClass(Test);
const methods = ref.getMethods(MethodFilter.Own | MethodFilter.Local);

for (const method of methods) {
	console.log(
		method.name,
		method.getParameters()
	);
}
```

### `ReflectionMethod`

This class allows you to query information about a class method, its parameters, and its metadata. It also makes it simple to invoke the method on demand.

Generally, you will retrieve instances of this class using `ReflectionClass`.

```ts
import { ReflectionClass, MethodFilter } from '@baileyherbert/common';

const instance = new TargetClass();
const ref = new ReflectionClass(instance);
const methods = ref.getMethods(MethodFilter.Own | MethodFilter.Local);
const method = methods.find(m => m.hasMetadata('example'));

// Invoke the method on the instance
// The first parameter is required as "this"
// The remaining parameters are sent to the method as args
method.invoke(instance);

// You can also create a closure to call the method later
const closure = method.createClosure(instance);
closure(...args);
```

---

## Native

### `Command`

This is a utility class that helps run a command or process. It provides an interface that can make it easier to manage
command line arguments, and offers simple events to listen for data or exit codes.

```ts
import { Command } from '@baileyherbert/common';

const command = new Command('ffmpeg');

command.setOption('-i', 'input_0.mp4');
command.setOption('-i', 'input_1.mp4');
command.setOption('-c', 'copy');
command.setOption('-map', '0:v:0');
command.setOption('-map', '1:a:0');
command.setFlag('-shortest');
command.setParameter('output.mp4');

// Listen for data
command.on('stderr', data => console.error(data));
command.on('stdout', data => console.log(data));

// The 'output' command is a combination of stderr and stdout
command.on('output', data => console.log(data));

// Start the process and wait for it to exit
const exitCode = await command.execute();
```

The class offers a `logging` option that will record all process output to an internal buffer. You can then read,
write, and clear the logged output.

```ts
// Set logging to true before executing the command
command.logging = true;
await command.execute();

// Get all output so far as a Buffer
const output = command.getLog();

// Write output to a file
await command.writeLog('filename.txt');

// Clear the log
command.clearLog();
```

---

## Decorators

### `@Reflectable`

This is a blank decorator used to trigger decorator emit for reflection. It can be applied to both classes and methods.

```ts
import { Reflectable } from '@baileyherbert/common';

@Reflectable()
class Test {}
```

### `@Resolvable`

This is a blank decorator used to trigger decorator emit for dependency injection. It can be applied to both classes and methods.

```ts
import { Reflectable } from '@baileyherbert/common';

// Adding this decorator to a class will make the parameter types for
// its constructor visible, which is necessary for dependency injection

@Reflectable()
class Test {
	public constructor(a: Foo) {

	}
}
```

---

## Types

### `Json`

These types describe data that can be serialized into (or deserialized from) a JSON string.

```ts
import { Json, JsonMap, JsonArray } from '@baileyherbert/common';
```

### `Key<T>`

This type is used to extract the keys from type, interface, or object `T`. It falls back to a generic `string` type if `T` is invalid or undefined.

```ts
import { Key } from '@baileyherbert/common';
```

### `Value<T, K, F>`

This type is used to extract the value of index `K` from object `T`. However, if the object `T` is invalid or undefined, then fallback `F` is returned.

```ts
import { Value } from '@baileyherbert/common';
```

### `Fallback<T, F>`

This type returns `T` if it is defined, or `F` otherwise.

```ts
import { Fallback } from '@baileyherbert/common';
```

### `Promisable<T>`

This type joins `T` and `Promise<T>`.

```ts
import { Promisable } from '@baileyherbert/common';
```

### `Type<T>`

This type represents the constructor of the given class `T`.

```ts
import { Type } from '@baileyherbert/common';
```

### `Action<T>`

This type represents a function that accepts any arguments with an optional return type `T` (defaults to `any`).

```ts
import { Action } from '@baileyherbert/common';
```
