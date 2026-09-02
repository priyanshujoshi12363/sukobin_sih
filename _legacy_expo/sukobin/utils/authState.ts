let globalConfirmation: any = null;

export const setConfirmation = (confirmation: any) => {
  globalConfirmation = confirmation;
  console.log('Confirmation stored:', !!globalConfirmation);
};

export const getConfirmation = () => {
  return globalConfirmation;
};

export const clearConfirmation = () => {
  globalConfirmation = null;
};