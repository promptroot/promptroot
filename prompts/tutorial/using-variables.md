# Using Variables in Prompts

Variables allow you to create reusable prompt templates that can be customized each time you use them. This is especially useful for common workflows where only a few details change between uses.

## What Are Prompt Variables?

Variables are placeholders in your prompt text that get filled in by you when you send the prompt to Jules. They use the syntax `{VARIABLE_NAME}` where the name must be uppercase letters, numbers, underscores, or hyphens.

### Example

Instead of writing:

```
Fix the bug in src/app.js on line 42.
```

You can create a reusable template:

```
Fix the bug in {FILE_PATH} on line {LINE_NUMBER}.
```

Each time you use this prompt, you'll be asked to provide the actual file path and line number.

## Variable Syntax Rules

✅ **Valid variable names:**
- `{FILE_PATH}` - uppercase letters with underscore
- `{LINE_NUMBER}` - uppercase with underscores
- `{USER-ID}` - uppercase with hyphen
- `{VAR1}` - uppercase with numbers
- `{COMPONENT}` - simple uppercase

❌ **Invalid variable names:**
- `{file_path}` - lowercase not allowed
- `{File.Path}` - dots not allowed
- `{file path}` - spaces not allowed
- `{filePath}` - mixed case not allowed

## How It Works

1. **Write your prompt** with `{VARIABLES}` where values should be customized
2. **Click "Try in Jules"** on the prompt
3. **Fill in the form** that appears with your specific values
4. **Click "Continue"** to send the substituted prompt to Jules

The variable substitution modal will:
- Show one input field for each unique variable
- Require all fields to be filled before sending
- Automatically sanitize input to prevent security issues
- Close if you click Cancel or the X button

## Common Use Cases

### 1. Debugging Specific Files

```markdown
## Debug File

Debug the function `{FUNCTION_NAME}` in file `{FILE_PATH}`.

Check if it properly handles:
- Edge cases
- Error conditions  
- The `{INPUT_TYPE}` input type

Review the logic around line `{LINE_NUMBER}` if specified.
```

**Variables:** FUNCTION_NAME, FILE_PATH, INPUT_TYPE, LINE_NUMBER

### 2. Configuration Updates

```markdown
## Update Configuration

Update the configuration in `{CONFIG_FILE}` to set the property 
`{PROPERTY_NAME}` to the value `{PROPERTY_VALUE}`.

Ensure the change is:
- Validated according to the schema
- Backward compatible
- Documented in comments
```

**Variables:** CONFIG_FILE, PROPERTY_NAME, PROPERTY_VALUE

### 3. Code Review Template

```markdown
## Code Review: {COMPONENT}

Please review the `{COMPONENT}` component in `{FILE_PATH}`.

Focus on:
1. Code quality and maintainability
2. Performance considerations
3. Security best practices
4. Test coverage

Specific concern: {REVIEW_FOCUS}
```

**Variables:** COMPONENT, FILE_PATH, REVIEW_FOCUS

### 4. Refactoring Tasks

```markdown
## Refactor {MODULE_NAME}

Refactor the `{MODULE_NAME}` module to:
- Improve code organization
- Reduce complexity
- Follow {STYLE_GUIDE} style guide

Target directories:
- `{SOURCE_DIR}`

Output to:
- `{OUTPUT_DIR}`
```

**Variables:** MODULE_NAME, STYLE_GUIDE, SOURCE_DIR, OUTPUT_DIR

### 5. Test Writing

```markdown
## Write Tests for {FEATURE}

Write comprehensive tests for the `{FEATURE}` feature in `{FILE_PATH}`.

Test types needed:
- Unit tests for `{MODULE_NAME}`
- Integration tests
- Edge case coverage

Use the {TEST_FRAMEWORK} testing framework.
```

**Variables:** FEATURE, FILE_PATH, MODULE_NAME, TEST_FRAMEWORK

## Advanced Patterns

### Multiple References to Same Variable

You can use the same variable multiple times in a prompt:

```markdown
Compare {FILE} with {FILE_BACKUP} and check if {FILE} contains 
all the critical functions. If {FILE} is missing anything, 
update {FILE} to match {FILE_BACKUP}.
```

Variables: FILE, FILE_BACKUP

When you fill in FILE="src/app.js", ALL occurrences of `{FILE}` get replaced with that value.

### Variables in Code Blocks

Variables work inside code blocks too:

```markdown
Run the following command:

\`\`\`bash
npm test -- {TEST_FILE}
npm run build --env={ENVIRONMENT}
\`\`\`
```

Variables: TEST_FILE, ENVIRONMENT

### Combining with Subtasks

Variables work seamlessly with subtask splitting:

```markdown
# Task 1
Update {FILE_A} to use the new API

---split---

# Task 2  
Update {FILE_B} to use the new API

---split---

# Task 3
Run tests for {FILE_A} and {FILE_B}
```

All three subtasks will use the same filled-in values for FILE_A and FILE_B.

## Best Practices

### 1. Use Descriptive Variable Names

✅ Good:
```
Fix {FILE_PATH} on line {LINE_NUMBER}
```

❌ Unclear:
```
Fix {F} on line {L}
```

### 2. Provide Context in the Prompt

Help others understand what values to provide:

```markdown
## Debug API Endpoint

Debug the API endpoint `{ENDPOINT_PATH}` (e.g., /api/users/123).

Check the handler in `{HANDLER_FILE}` (e.g., src/api/users.ts).
```

### 3. Group Related Variables

Keep related variables together for easier filling:

```markdown
## Deploy {SERVICE_NAME}

Service: {SERVICE_NAME}
Environment: {ENVIRONMENT}
Version: {VERSION}

Deploy to: {TARGET_CLUSTER}
```

### 4. Combine Fixed and Variable Content

Mix template variables with consistent instructions:

```markdown
## Standardized Review

Review `{FILE_PATH}` for:

1. Code quality (always check this)
2. Security issues (always check this)
3. Custom focus: {CUSTOM_FOCUS}
```

### 5. Create Template Libraries

Organize reusable templates in folders:

```
prompts/
  templates/
    debug/
      debug-function.md  (uses {FUNCTION_NAME}, {FILE_PATH})
      debug-api.md       (uses {ENDPOINT}, {METHOD})
    refactor/
      refactor-module.md (uses {MODULE_NAME}, {TARGET_DIR})
```

## Limitations

Current limitations (by design):

- **No default values**: All variables must be filled (no optional variables yet)
- **No complex logic**: No conditionals, loops, or computed values
- **Text only**: Variables are simple text substitution
- **Uppercase only**: Only uppercase variable names are detected
- **Max length**: Input limited to 1000 characters per variable

These keep the system simple and maintain the zero-build philosophy.

## Security

All variable inputs are automatically sanitized:
- HTML tags are stripped from your input
- Script tags cannot be injected
- Your input is treated as plain text

This happens automatically - you don't need to worry about it.

## Tips and Tricks

### Quick Testing

Create a copy of your template prompt with example values to test:

```markdown
# Original template
Fix {FILE_PATH} on line {LINE_NUMBER}

# Test version (in same file, lower down)
Fix src/app.js on line 42
```

### Sharing Templates

When sharing prompt templates with your team:
1. Document what each variable expects in comments
2. Provide examples of valid values
3. Explain the use case in a header

### Keyboard Shortcuts

In the variable modal:
- **Tab**: Move between input fields
- **Enter**: Submit (when all fields filled)
- **Escape**: Cancel and close modal

### Empty Values

If you need an optional part of the prompt, include it in the text:

```markdown
Debug {FILE_PATH}. 
Additional context: {CONTEXT}
```

If CONTEXT is empty, you'll get "Additional context: " - which is fine for most cases.

## Examples in This Repository

See these files for working examples:

- `prompts/tutorial/templates/variable-substitution-test.md` - Test examples
- This file - Tutorial with inline examples

Try clicking "Try in Jules" on any prompt with `{VARIABLES}` to see how it works!

## Troubleshooting

**Q: My variables aren't being detected**  
A: Make sure they're uppercase: `{NAME}` not `{name}`

**Q: The modal won't submit**  
A: All fields are required - check that you've filled every input

**Q: I want to cancel mid-way**  
A: Click the X button, Cancel button, or click outside the modal

**Q: Can I have spaces in variable names?**  
A: No, use underscores instead: `{USER_NAME}` not `{USER NAME}`

**Q: What if I don't want something to be a variable?**  
A: Use lowercase or different punctuation: `{code}` won't be detected as a variable

## Future Enhancements

Possible future additions:
- Default values: `{NAME:DefaultValue}`
- Optional variables: `{NAME?}`
- Multi-line textarea for long inputs
- Save filled templates for reuse
- Template library browser

These maintain the simple, zero-build philosophy while adding convenience.
