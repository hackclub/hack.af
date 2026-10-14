import { clientEntry, css, on, type Handle } from "remix/component";

const selectStyle = css({
  height: "32px",
  padding: "0 30px 0 10px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\") no-repeat right 8px center / 14px, var(--surface)",
  boxShadow: "var(--shadow-sm)",
  fontSize: "var(--text-sm)",
  appearance: "none",
  cursor: "pointer",
  outline: "none",
  "&:hover": { borderColor: "var(--border-strong)" },
  "&:focus-visible": { borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-soft)" },
});

// A native select that applies its GET form as soon as the choice changes
export const FilterSelect = clientEntry(
  import.meta.url,
  function FilterSelect(
    handle: Handle<{
      name: string;
      label: string;
      value: string;
      options: { value: string; label: string }[];
    }>,
  ) {
    return () => {
      const { name, label, value, options } = handle.props;
      return (
        <select
          name={name}
          aria-label={label}
          mix={[selectStyle, on("change", (event) => event.currentTarget.form?.requestSubmit())]}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} selected={option.value === value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    };
  },
);
