const open = {
  params: null,
  root: null,

  init: (params, root) => {
    open.params = params;
    open.root = root;
  },

  verifyInput: () => {
    console.log('Verifying input with params:', open.params, 'and root:', open.root);
    
  },

  verifyPrice: () => {
    console.log('Verifying price');
  }
};

export default open;
