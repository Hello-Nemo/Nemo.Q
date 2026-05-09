type DecisionOptionKeyInput = {
  label?: string;
  value?: string;
};

export function getDecisionOptionKey(option: DecisionOptionKeyInput, index: number) {
  return `${option.value || option.label || 'option'}-${index}`;
}
