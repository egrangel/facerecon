import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Checkbox from './ui/Checkbox';
import RadioGroup, { RadioOption } from './ui/RadioGroup';
import Select, { SelectOption } from './ui/Select';

const ThemeComponentsDemo: React.FC = () => {
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [selectValue, setSelectValue] = useState('');

  const radioOptions: RadioOption[] = [
    { value: 'option1', label: 'Option 1', description: 'This is the first option' },
    { value: 'option2', label: 'Option 2', description: 'This is the second option' },
    { value: 'option3', label: 'Option 3', description: 'This is the third option' },
    { value: 'option4', label: 'Disabled Option', description: 'This option is disabled', disabled: true },
  ];

  const selectOptions: SelectOption[] = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'disabled', label: 'Disabled Option', disabled: true },
  ];

  return (
    <div className="space-y-8 p-6 bg-[var(--color-background-primary)] min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          Theme-Aware Components Demo
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Demonstrating checkbox, radio group, and select components that adapt to the current theme.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checkbox Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Checkbox Component</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Checkbox
              label="Simple Checkbox"
              description="This is a basic checkbox with theme colors"
              checked={checkboxValue}
              onChange={(e) => setCheckboxValue(e.target.checked)}
            />

            <Checkbox
              label="Checked by Default"
              description="This checkbox starts checked"
              defaultChecked
            />

            <Checkbox
              label="Disabled Checkbox"
              description="This checkbox is disabled"
              disabled
            />

            <Checkbox
              label="Disabled Checked"
              description="This checkbox is disabled and checked"
              disabled
              checked
            />

            <Checkbox
              label="Checkbox with Error"
              description="This checkbox has an error state"
              error="This field is required"
            />
          </CardContent>
        </Card>

        {/* RadioGroup Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Radio Group Component</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              name="demo-radio"
              label="Vertical Radio Group"
              description="Choose one option from the list below"
              options={radioOptions}
              value={radioValue}
              onChange={setRadioValue}
              orientation="vertical"
            />

            <RadioGroup
              name="horizontal-radio"
              label="Horizontal Radio Group"
              description="Options displayed horizontally"
              options={radioOptions.slice(0, 3)}
              defaultValue="option2"
              orientation="horizontal"
            />

            <RadioGroup
              name="disabled-radio"
              label="Disabled Radio Group"
              description="This entire group is disabled"
              options={radioOptions.slice(0, 2)}
              defaultValue="option1"
              disabled
            />
          </CardContent>
        </Card>

        {/* Select Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Select Component</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Basic Select"
              description="Choose your favorite fruit"
              placeholder="Select a fruit..."
              options={selectOptions}
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
            />

            <Select
              label="Small Select"
              description="Compact size variant"
              placeholder="Choose option..."
              options={selectOptions}
              size="sm"
            />

            <Select
              label="Large Select"
              description="Large size variant"
              placeholder="Choose option..."
              options={selectOptions}
              size="lg"
            />

            <Select
              label="Disabled Select"
              description="This select is disabled"
              placeholder="Cannot select..."
              options={selectOptions}
              disabled
            />

            <Select
              label="Select with Error"
              description="This select has an error state"
              placeholder="Choose option..."
              options={selectOptions}
              error="Please select a valid option"
            />
          </CardContent>
        </Card>

        {/* Combined Example */}
        <Card>
          <CardHeader>
            <CardTitle>Form Example</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6">
              <Input
                label="Name"
                placeholder="Enter your name"
              />

              <Select
                label="Country"
                placeholder="Select your country"
                options={[
                  { value: 'us', label: 'United States' },
                  { value: 'ca', label: 'Canada' },
                  { value: 'uk', label: 'United Kingdom' },
                  { value: 'br', label: 'Brazil' },
                ]}
              />

              <RadioGroup
                name="subscription"
                label="Subscription Type"
                description="Choose your preferred subscription"
                options={[
                  { value: 'free', label: 'Free', description: 'Basic features only' },
                  { value: 'pro', label: 'Pro', description: 'Advanced features included' },
                  { value: 'enterprise', label: 'Enterprise', description: 'Full feature access' },
                ]}
                defaultValue="free"
              />

              <div className="space-y-3">
                <Checkbox
                  label="Subscribe to newsletter"
                  description="Get updates about new features"
                />
                <Checkbox
                  label="Accept terms and conditions"
                  description="You must accept to continue"
                />
              </div>

              <div className="flex space-x-3">
                <Button type="submit">
                  Submit
                </Button>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ThemeComponentsDemo;