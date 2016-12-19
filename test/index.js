import test from 'tape';
import proxyquire from 'proxyquire';
import {actionCreator, asyncActionCreator, createTypes, async} from '../src';

test('createTypes() returns an object with action type keys and values', t => {
  const types = createTypes(['CREATE_CAR', 'EDIT_CAR', 'EDIT_WHEELS']);
  t.equal(Object.keys(types).length, 3, 'contains three types');
  t.equal(types.CREATE_CAR, 'CREATE_CAR', 'CREATE_CAR exists');
  t.equal(types.EDIT_CAR, 'EDIT_CAR', 'EDIT_CAR exists');
  t.equal(types.EDIT_WHEELS, 'EDIT_WHEELS', 'EDIT_WHEELS exists');
  t.end();
});

test('createTypes() returns an object with action type keys and namespaced action type values', t => {
  const types = createTypes(['CREATE_CAR', 'EDIT_CAR', 'EDIT_WHEELS'], 'CAR');
  t.equal(Object.keys(types).length, 3, 'contains three types');
  t.equal(types.CREATE_CAR, 'CAR_CREATE_CAR', 'CREATE_CAR exists and is namespaced correctly');
  t.equal(types.EDIT_CAR, 'CAR_EDIT_CAR', 'EDIT_CAR exists and is namespaced correctly');
  t.equal(types.EDIT_WHEELS, 'CAR_EDIT_WHEELS', 'EDIT_WHEELS exists and is namespaced correctly');
  t.end();
});

test('async() returns an array containing the original type plus success/fail variants', t => {
  const actions = async('FOOBAR');
  t.notEqual(actions.indexOf('FOOBAR'), -1, 'actions contains type');
  t.notEqual(actions.indexOf('FOOBAR_SUCCESS'), -1, 'actions contains success type variant');
  t.notEqual(actions.indexOf('FOOBAR_FAIL'), -1, 'actions contains fail type variant');
  t.end();
});

test('actionCreator() returns a function that creates an action with the given type', t => {
  const createAction = actionCreator('FOOBAR');
  const action = createAction();
  t.equal(Object.keys(action).length, 2, 'action contains the type and payload');
  t.equal(action.type, 'FOOBAR', 'the type is correct');
  t.equal(Object.keys(action.payload).length, 0, 'the payload is empty');
  t.end();
});

test('actionCreator() returns a function that creates an action with the given type and parameters', t => {
  const createAction = actionCreator('FOO', 'bar', 'baz', 'qux');
  const action = createAction('bar', 'baz', 'qux');
  t.equal(Object.keys(action.payload).length, 3, 'the payload contains three parameters');
  t.equal(action.payload.bar, 'bar', 'bar payload exists');
  t.equal(action.payload.baz, 'baz', 'baz payload exists');
  t.equal(action.payload.qux, 'qux', 'qux payload exists');
  t.end();
});

test("asyncActionCreator() dispatches an action type followed by it's successful variant with response on completion of action", t => {
  t.plan(3);
  const createActionDispatcher = asyncActionCreator('FOOBAR', () => Promise.resolve('Hello World!'));
  const dispatchAction = createActionDispatcher();
  const actions = ['FOOBAR', 'FOOBAR_SUCCESS'];
  let index = 0;
  dispatchAction(action => {
    const type = actions[index++];
    t.equal(action.type, type, `${type} is dispatched`);
    if (type === 'FOOBAR_SUCCESS') t.equal(action.response, 'Hello World!', `response is present`);
  });
});

test("asyncActionCreator() dispatches an action type followed by it's fail variant with error details on action error", t => {
  t.plan(4);
  const createActionDispatcher = asyncActionCreator('FOOBAR', () => Promise.reject({message: 'error message', code: 500}));
  const dispatchAction = createActionDispatcher();
  const actions = ['FOOBAR', 'FOOBAR_FAIL'];
  let index = 0;
  dispatchAction(action => {
    const type = actions[index++];
    t.equal(action.type, type, `${type} is dispatched`);
    if (type === 'FOOBAR_FAIL') {
      t.equal(action.error.message, 'error message', `error message is present`);
      t.equal(action.error.code, 500, `error code is present`);
    }
  });
});

test("asyncActionCreator() success actions include payload", t => {
  t.plan(4);
  const createActionDispatcher = asyncActionCreator('FOOBAR', ({foo, bar}) => {
    t.equal(foo, 'baz', 'foo payload exists');
    t.equal(bar, 'qux', 'bar payload exists');
    return Promise.resolve();
  });
  const dispatchAction = createActionDispatcher({foo: 'baz', bar: 'qux'});
  const actions = ['FOOBAR', 'FOOBAR_SUCCESS'];
  let index = 0;
  dispatchAction(action => {
    if (index++ === 1) {
      t.equal(action.payload.foo, 'baz', 'foo payload exists in success action');
      t.equal(action.payload.bar, 'qux', 'bar payload exists in success action');
    }
  });
});

test("asyncActionCreator() error actions include payload", t => {
  t.plan(2);
  const createActionDispatcher = asyncActionCreator('FOOBAR', ({foo, bar}) => Promise.reject({message: 'error'}));
  const dispatchAction = createActionDispatcher({foo: 'baz', bar: 'qux'});
  const actions = ['FOOBAR', 'FOOBAR_FAIL'];
  let index = 0;
  dispatchAction(action => {
    if (index++ === 1) {
      t.equal(action.payload.foo, 'baz', 'foo payload exists in success action');
      t.equal(action.payload.bar, 'qux', 'bar payload exists in success action');
    }
  });
});

test("asyncActionCreator() runs server action when node detected", t => {
  t.plan(1);
  const createActionDispatcher = asyncActionCreator('FOOBAR', {
    server({foo, bar}) {
      t.pass('server action is run');
      return Promise.resolve();
    },
    client({foo, bar}) {
      t.fail('client action is run');
      return Promise.resolve();
    }
  });
  const dispatchAction = createActionDispatcher({foo: 'baz', bar: 'qux'});
  dispatchAction(() => ({}));
});

test("asyncActionCreator() runs client action when browser detected", t => {
  const {asyncActionCreator: browserAsyncActionCreator} = proxyquire('../src', {'detect-node': false});
  t.plan(1);
  const createActionDispatcher = browserAsyncActionCreator('FOOBAR', {
    server({foo, bar}) {
      t.fail('server action is run');
      return Promise.resolve();
    },
    client({foo, bar}) {
      t.pass('client action is run');
      return Promise.resolve();
    }
  });
  const dispatchAction = createActionDispatcher({foo: 'baz', bar: 'qux'});
  dispatchAction(() => ({}));
});

test("asyncActionCreator() calls normalizr when schema is provided", t => {
  t.plan(2);
  const mockResponse = {entities: 'foobar'};
  const mockSchema = {some: 'schema'};
  const {asyncActionCreator: schemaAsyncActionCreator} = proxyquire('../src', {
    normalizr: {
      normalize(response, schema) {
        t.equal(response, mockResponse, 'action response is passed to normalizr');
        t.equal(schema, mockSchema, 'schema is passed to normalizr');
      }
    }
  });
  const createActionDispatcher = schemaAsyncActionCreator('FOOBAR', {
    schema: mockSchema,
    server(foo, bar) {
      return Promise.resolve(mockResponse);
    }
  });
  const dispatchAction = createActionDispatcher();
  dispatchAction(() => ({}));
});
