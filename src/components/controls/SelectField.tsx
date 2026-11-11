type SelectFieldProps = {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  /** Keep the label for screen readers only. */
  hideLabel?: boolean;
};

const SelectField = ({ label, htmlFor, children, hideLabel }: SelectFieldProps) => {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={htmlFor} className={hideLabel ? "sr-only" : "whitespace-nowrap mr-2 min-w-9"}>
        {label}
      </label>
      {children}
    </div>
  );
};

export default SelectField;
