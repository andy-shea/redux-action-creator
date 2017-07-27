import {normalize} from 'normalizr';
import isNode from 'detect-node';

const SUCCESS = 'SUCCESS';
const FAIL = 'FAIL';

export function actionCreator(type, ...params) {
  return (...args) => {
    return params.reduce((action, param, index) => {
      action.payload[param] = args[index];
      return action;
    }, {type, payload: {}});
  };
}

async function executeAsyncAction(type, config, payload, dispatch, args) {
  if (typeof config === 'function') config = {action: config}; // eslint-disable-line no-param-reassign
  const {client, server, schema} = config;
  const action = config.action || (isNode ? server : client);
  try {
    const response = await action(payload, dispatch, ...args);
    return dispatch({
      type: `${type}_${SUCCESS}`,
      payload,
      response: schema ? normalize(response, schema) : response
    });
  }
  catch (error) {
    return dispatch({type: `${type}_${FAIL}`, payload, error});
  }
}

export function asyncActionCreator(type, config) {
  return payload => async (dispatch, ...args) => {
    dispatch({type, payload});
    return await executeAsyncAction(type, config, payload, dispatch, args);
  };
}

export function asyncRoute(type, path, config, helpers) {
  const {client, server, schema, ...rest} = config;
  return {
    [type]: {
      path,
      thunk: async (dispatch, getState) => {
        const state = getState();
        const {location: {payload}} = state;
        return await executeAsyncAction(type, config, payload, dispatch, [getState, helpers]);
      },
      ...rest
    }
  };
}

export function createTypes(types, namespace) {
  return types.reduce((typeMap, type) => {
    typeMap[type] = namespace ? `${namespace}_${type}` : type;
    return typeMap;
  }, {});
}

export function createRouteTypes(types) {
  return createTypes(types, 'ROUTES');
}

export function async(type) {
  return [type, `${type}_${SUCCESS}`, `${type}_${FAIL}`];
}
