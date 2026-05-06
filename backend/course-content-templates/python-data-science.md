# Python Data Science: Proficiency to Production
## Course Outline & Teaching Framework

## Five Core Sections

### Section 1: Python Proficiency
**Topics:** Variables, loops, functions, and reusable scripts for data workflows

---

#### 1.1 Variables
**Concept:** Store and manage data types (int, float, str, bool, list, dict)

**Working Example Video:**
```python
# Declare and assign variables
name = "Alex"          # String
age = 28               # Integer
salary = 75000.50      # Float
is_manager = True      # Boolean

# Lists (ordered, mutable)
skills = ["Python", "SQL", "Excel"]
print(f"{name} knows {len(skills)} skills")

# Dictionaries (key-value pairs)
employee = {
    "name": "Alex",
    "department": "Data",
    "salary": 75000.50
}
print(f"Department: {employee['department']}")

# Variable scope
def show_scope():
    local_var = "This is local"
    return local_var

result = show_scope()
print(result)
# local_var is not accessible outside the function
```

**Key Takeaway:** Variables are containers. Know your data types and understand scope.

---

#### 1.2 Loops
**Concept:** Iterate over collections without writing repetitive code

**Working Example Video:**
```python
# For loop: iterate over a list
sales = [1000, 1500, 2000, 1200, 1800]
total = 0

for sale in sales:
    total += sale
    print(f"Sale: ${sale}, Running total: ${total}")

print(f"Total sales: ${total}")

# For loop with index (enumerate)
for index, sale in enumerate(sales):
    print(f"Month {index + 1}: ${sale}")

# While loop: repeat until condition is false
count = 0
while count < 5:
    print(f"Count: {count}")
    count += 1

# Nested loops: loop within a loop
departments = ["Sales", "Engineering", "HR"]
regions = ["North", "South"]

for dept in departments:
    for region in regions:
        print(f"{dept} - {region}")

# Dictionary iteration
employee_salaries = {"Alice": 80000, "Bob": 75000, "Carol": 90000}
for name, salary in employee_salaries.items():
    print(f"{name} earns ${salary:,}")
```

**Key Takeaway:** Loops eliminate repetition. Use `for` for collections, `while` for conditions.

---

#### 1.3 Functions
**Concept:** Write reusable blocks of code with inputs (parameters) and outputs (return values)

**Working Example Video:**
```python
# Simple function with no parameters
def greet():
    return "Hello, welcome to data science!"

print(greet())

# Function with parameters
def calculate_bonus(salary, bonus_rate=0.1):
    """
    Calculate employee bonus.
    Args:
        salary (float): Base salary
        bonus_rate (float): Bonus as % of salary (default 10%)
    Returns:
        float: Bonus amount
    """
    return salary * bonus_rate

print(f"Bonus: ${calculate_bonus(80000)}")
print(f"Bonus: ${calculate_bonus(80000, 0.15)}")

# Function with multiple return values
def analyze_sales(sales_list):
    total = sum(sales_list)
    average = total / len(sales_list)
    max_sale = max(sales_list)
    return total, average, max_sale

sales = [1000, 1500, 2000, 1200, 1800]
total, avg, max_val = analyze_sales(sales)
print(f"Total: ${total}, Avg: ${avg}, Max: ${max_val}")

# Function that processes and returns data
def format_currency(amount):
    return f"${amount:,.2f}"

salary = 85000
print(format_currency(salary))
```

**Key Takeaway:** Functions are reusable. Use parameters for inputs, return for outputs. Document with docstrings.

---

#### 1.4 Reusable Scripts for Data Workflows
**Concept:** Combine variables, loops, and functions into a workflow module

**Working Example Video:**
```python
# data_utils.py - A reusable module for data operations

def load_sales_data(filename):
    """Load sales from a text file (CSV-like)"""
    sales = []
    with open(filename, 'r') as f:
        for line in f:
            try:
                sales.append(float(line.strip()))
            except ValueError:
                continue
    return sales

def clean_sales_data(sales_list, remove_outliers=True):
    """Remove None/invalid values and optionally remove outliers"""
    cleaned = [s for s in sales_list if s is not None and s > 0]
    
    if remove_outliers:
        mean = sum(cleaned) / len(cleaned)
        std_dev = (sum((x - mean) ** 2 for x in cleaned) / len(cleaned)) ** 0.5
        cleaned = [s for s in cleaned if abs(s - mean) <= 2 * std_dev]
    
    return cleaned

def summarize_sales(sales_list):
    """Return summary statistics"""
    if not sales_list:
        return None
    
    total = sum(sales_list)
    count = len(sales_list)
    average = total / count
    max_sale = max(sales_list)
    min_sale = min(sales_list)
    
    return {
        "total": total,
        "count": count,
        "average": average,
        "max": max_sale,
        "min": min_sale
    }

# Usage in a workflow
if __name__ == "__main__":
    # Load data
    sales = load_sales_data("sales.txt")
    print(f"Loaded {len(sales)} sales records")
    
    # Clean data
    cleaned = clean_sales_data(sales, remove_outliers=True)
    print(f"After cleaning: {len(cleaned)} records")
    
    # Summarize
    summary = summarize_sales(cleaned)
    print(f"Summary: {summary}")
    print(f"Average Sale: ${summary['average']:.2f}")
```

**Key Takeaway:** Package functions into modules. This enables code reuse across projects and team collaboration.

---

**Section 1 Success Checkpoint:**
- ✅ Declare and use variables (all types)
- ✅ Iterate with for and while loops
- ✅ Write functions with parameters and return values
- ✅ Create a simple reusable module with multiple functions

---

### Section 2: NumPy
**Topics:** Array operations, vectorized math, and matrix manipulation for performance

---

#### 2.1 Creating and Inspecting Arrays
**Concept:** Initialize NumPy arrays and understand their shape, dtype, and structure

**Working Example Video:**
```python
import numpy as np

# Create arrays from Python lists
arr1d = np.array([10, 20, 30, 40, 50])
arr2d = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]])

print(f"1D array: {arr1d}")
print(f"2D array:\n{arr2d}")

# Create arrays with special values
zeros = np.zeros((3, 4))        # 3x4 matrix of zeros
ones = np.ones(5)               # 1D array of ones
range_arr = np.arange(0, 10, 2) # 0, 2, 4, 6, 8
linspace = np.linspace(0, 1, 5) # 5 evenly spaced values from 0 to 1

# Inspect array properties
print(f"Shape: {arr2d.shape}")           # (3, 3)
print(f"Data type: {arr2d.dtype}")       # int64
print(f"Number of dimensions: {arr2d.ndim}") # 2
print(f"Total elements: {arr2d.size}")   # 9

# Reshape an array
reshaped = arr1d.reshape(5, 1)  # Convert to column vector
print(f"Reshaped:\n{reshaped}")
```

**Key Takeaway:** NumPy arrays are efficient containers for numerical data. Understand shape and dtype for debugging.

---

#### 2.2 Element-Wise Operations (Vectorization)
**Concept:** Apply operations to entire arrays without explicit loops

**Working Example Video:**
```python
import numpy as np

# Sample sales data
sales = np.array([1000, 1500, 2000, 1200, 1800])
bonus_rate = 0.1

# Element-wise operations (no loop needed!)
bonuses = sales * bonus_rate
print(f"Sales: {sales}")
print(f"Bonuses (10%): {bonuses}")

# Arithmetic operations
total_payout = sales + bonuses
print(f"Total Payout: {total_payout}")

# Comparison (returns boolean array)
high_sales = sales > 1500
print(f"High Sales (> $1500): {high_sales}")
print(f"Sales > $1500: {sales[high_sales]}")

# Mathematical functions
temperatures = np.array([32, 68, 104, 86, 59])
temp_celsius = (temperatures - 32) * 5/9
print(f"Celsius: {temp_celsius}")

# Statistical operations
print(f"Sum: {np.sum(sales)}")
print(f"Mean: {np.mean(sales)}")
print(f"Std Dev: {np.std(sales)}")
print(f"Min: {np.min(sales)}, Max: {np.max(sales)}")

# Why this matters: this is 10-100x faster than Python loops
```

**Key Takeaway:** Vectorization is the core skill. Replace loops with NumPy operations for speed and readability.

---

#### 2.3 Broadcasting and Indexing
**Concept:** Apply operations across arrays of different shapes; extract subsets efficiently

**Working Example Video:**
```python
import numpy as np

# Broadcasting: operate on arrays of different shapes
sales_daily = np.array([[1000, 1500, 2000],
                        [1200, 1800, 1600],
                        [900, 1100, 1400]])  # 3 days, 3 products

bonus_rate = np.array([0.10, 0.15, 0.20])  # Different rate per product

# Broadcasting: (3, 3) * (3,) → (3, 3)
bonuses = sales_daily * bonus_rate
print(f"Bonuses by product:\n{bonuses}")

# Indexing and slicing
print(f"First row: {sales_daily[0]}")
print(f"First column: {sales_daily[:, 0]}")
print(f"Middle element: {sales_daily[1, 1]}")
print(f"Last two elements of first row: {sales_daily[0, -2:]}")

# Boolean indexing: select rows where sum > 4000
row_totals = np.sum(sales_daily, axis=1)
high_performing = sales_daily[row_totals > 4000]
print(f"High-performing days:\n{high_performing}")

# Fancy indexing: select specific rows
selected_rows = sales_daily[[0, 2]]  # Get rows 0 and 2
print(f"Selected rows:\n{selected_rows}")
```

**Key Takeaway:** Broadcasting saves memory. Smart indexing extracts exactly what you need.

---

#### 2.4 Matrix Operations
**Concept:** Perform linear algebra operations (dot product, transpose, inversion)

**Working Example Video:**
```python
import numpy as np

# Create sample matrices
A = np.array([[1, 2, 3],
              [4, 5, 6]])  # 2x3

B = np.array([[7, 8],
              [9, 10],
              [11, 12]])  # 3x2

# Dot product (matrix multiplication)
result = np.dot(A, B)  # 2x3 × 3x2 = 2x2
print(f"A × B:\n{result}")

# Transpose (flip rows and columns)
C = np.array([[1, 2], [3, 4], [5, 6]])
transposed = C.T
print(f"Original:\n{C}")
print(f"Transposed:\n{transposed}")

# Matrix inversion (for square matrices)
square = np.array([[1, 2], [3, 4]], dtype=float)
inverse = np.linalg.inv(square)
print(f"Inverse:\n{inverse}")

# Verify: A × A_inverse = Identity
identity = np.dot(square, inverse)
print(f"A × A_inv (should be ~Identity):\n{identity}")

# Eigenvalues and eigenvectors
eigenvalues, eigenvectors = np.linalg.eig(square)
print(f"Eigenvalues: {eigenvalues}")
```

**Key Takeaway:** Matrix operations are the foundation of machine learning. Master them now.

---

**Section 2 Success Checkpoint:**
- ✅ Create and reshape NumPy arrays
- ✅ Perform element-wise operations without loops
- ✅ Use broadcasting to operate on different shapes
- ✅ Extract subsets using indexing and slicing
- ✅ Compute dot products and matrix operations

---

### Section 3: Pandas
**Topics:** Data loading, cleaning, filtering, and transformation

---

#### 3.1 Loading Data and Exploring DataFrames
**Concept:** Import data from various sources and understand structure

**Working Example Video:**
```python
import pandas as pd

# Load from CSV
df = pd.read_csv('employees.csv')

# Load from Excel
df = pd.read_excel('sales.xlsx')

# Load from SQL (with connection)
import sqlite3
conn = sqlite3.connect('database.db')
df = pd.read_sql('SELECT * FROM transactions', conn)

# Inspect the DataFrame
print(df.head())           # First 5 rows
print(df.tail())           # Last 5 rows
print(df.info())           # Data types and nulls
print(df.describe())       # Statistical summary
print(df.shape)            # (rows, columns)
print(df.columns)          # Column names

# Get specific info
print(f"Data types:\n{df.dtypes}")
print(f"Missing values:\n{df.isnull().sum()}")
print(f"Memory usage: {df.memory_usage().sum() / 1024**2:.2f} MB")
```

**Key Takeaway:** Always explore first. `head()`, `info()`, `describe()` tell the full story.

---

#### 3.2 Handling Missing Values
**Concept:** Detect, handle, and document null data

**Working Example Video:**
```python
import pandas as pd
import numpy as np

# Create sample data with missing values
df = pd.DataFrame({
    'name': ['Alice', 'Bob', None, 'David'],
    'salary': [80000, None, 95000, 75000],
    'department': ['Sales', 'Engineering', 'Sales', None]
})

# Detect missing values
print(df.isnull())          # Boolean DataFrame
print(df.isnull().sum())    # Count per column

# Strategy 1: Drop rows with any missing values
df_dropped = df.dropna()
print(f"After dropna(): {len(df_dropped)} rows")

# Strategy 2: Drop rows where specific column is null
df_dropped_salary = df.dropna(subset=['salary'])

# Strategy 3: Fill with a constant value
df_filled_const = df.fillna({
    'salary': df['salary'].mean(),
    'department': 'Unknown'
})

# Strategy 4: Forward fill (propagate last value)
df_filled_forward = df.fillna(method='ffill')

# Strategy 5: Interpolate (for time-series)
df_filled_interp = df.fillna(method='bfill')

# Drop specific columns if too sparse
df_dropped_col = df.drop(columns=['department'])

print(f"Final shape: {df_filled_const.shape}")
```

**Key Takeaway:** Different strategies for different scenarios. Document your choice.

---

#### 3.3 Filtering, Selecting, and Subsetting
**Concept:** Extract rows and columns based on conditions

**Working Example Video:**
```python
import pandas as pd

# Sample employee data
df = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Carol', 'David'],
    'salary': [80000, 75000, 95000, 70000],
    'department': ['Sales', 'Engineering', 'Sales', 'HR'],
    'years': [3, 5, 7, 1]
})

# Select columns
print(df['name'])           # Single column → Series
print(df[['name', 'salary']]) # Multiple columns → DataFrame

# Filter rows by condition
high_earners = df[df['salary'] > 80000]
print(f"High earners:\n{high_earners}")

# Multiple conditions
sales_engineers = df[(df['department'] == 'Sales') | (df['department'] == 'Engineering')]

# Filter by text (contains)
names_with_a = df[df['name'].str.contains('a', case=False)]

# Filter by year
senior = df[df['years'] >= 5]

# Using .loc and .iloc
print(df.loc[1, 'salary'])        # Row index 1, column 'salary'
print(df.iloc[0, 1])              # First row, second column
print(df.loc[df['department'] == 'Sales', 'salary'])  # Salary of all Sales employees

# Drop rows or columns
df_without_carol = df[df['name'] != 'Carol']
df_without_years = df.drop(columns=['years'])
```

**Key Takeaway:** Filtering is your most-used operation. Master `.loc[]` and `.iloc[]`.

---

#### 3.4 Grouping, Aggregating, and Transforming
**Concept:** Summarize data by groups (department, region, product)

**Working Example Video:**
```python
import pandas as pd

# Sales data with multiple transactions per region
sales = pd.DataFrame({
    'region': ['North', 'South', 'North', 'East', 'South', 'East'],
    'product': ['A', 'B', 'B', 'A', 'A', 'B'],
    'amount': [1000, 1500, 2000, 1200, 1800, 900],
    'date': pd.date_range('2024-01-01', periods=6)
})

# Group by single column
region_totals = sales.groupby('region')['amount'].sum()
print(f"Total by region:\n{region_totals}")

# Group by multiple columns
region_product = sales.groupby(['region', 'product'])['amount'].sum()
print(f"By region & product:\n{region_product}")

# Multiple aggregations
summary = sales.groupby('region').agg({
    'amount': ['sum', 'mean', 'count'],
    'date': ['min', 'max']
})
print(f"Summary:\n{summary}")

# Custom aggregation function
def revenue_range(x):
    return x.max() - x.min()

custom_agg = sales.groupby('region')['amount'].agg([
    ('total', 'sum'),
    ('average', 'mean'),
    ('range', revenue_range)
])
print(f"Custom agg:\n{custom_agg}")

# Transform: apply function to group, return original size
sales['region_mean'] = sales.groupby('region')['amount'].transform('mean')
print(f"With region mean:\n{sales}")

# Pivot table: cross-tabulation
pivot = sales.pivot_table(values='amount', index='region', columns='product', aggfunc='sum')
print(f"Pivot table:\n{pivot}")
```

**Key Takeaway:** Groupby is like SQL's GROUP BY. Aggregations answer business questions.

---

#### 3.5 Merging, Joining, and Reshaping
**Concept:** Combine multiple DataFrames and reshape data

**Working Example Video:**
```python
import pandas as pd

# Two DataFrames to merge
employees = pd.DataFrame({
    'emp_id': [1, 2, 3],
    'name': ['Alice', 'Bob', 'Carol'],
    'dept_id': [10, 20, 10]
})

departments = pd.DataFrame({
    'dept_id': [10, 20, 30],
    'dept_name': ['Sales', 'Engineering', 'HR']
})

# Inner join (only matching rows)
merged_inner = pd.merge(employees, departments, on='dept_id', how='inner')
print(f"Inner join:\n{merged_inner}")

# Left join (keep all from left)
merged_left = pd.merge(employees, departments, on='dept_id', how='left')
print(f"Left join:\n{merged_left}")

# Concatenate DataFrames (row-wise)
df1 = pd.DataFrame({'A': [1, 2], 'B': [3, 4]})
df2 = pd.DataFrame({'A': [5, 6], 'B': [7, 8]})
concat_result = pd.concat([df1, df2], ignore_index=True)
print(f"Concatenated:\n{concat_result}")

# Reshape: wide to long (melt)
wide = pd.DataFrame({
    'month': ['Jan', 'Feb'],
    'North': [1000, 1200],
    'South': [1500, 1800]
})

long = wide.melt(id_vars=['month'], var_name='region', value_name='sales')
print(f"Long format:\n{long}")

# Reshape: long to wide (pivot)
pivoted = long.pivot(index='month', columns='region', values='sales')
print(f"Wide format:\n{pivoted}")
```

**Key Takeaway:** Merge for adding columns, concatenate for adding rows. Use pivot/melt to reshape.

---

**Section 3 Success Checkpoint:**
- ✅ Load data from CSV, Excel, SQL
- ✅ Detect and handle missing values
- ✅ Filter rows and select columns
- ✅ Group by and aggregate data
- ✅ Merge and concatenate DataFrames
- ✅ Reshape data from wide to long and vice versa

---

### Section 4: Matplotlib
**Topics:** Exploratory plots to inspect trends, outliers, and distributions

---

#### 4.1 Line and Area Charts
**Concept:** Show trends over time or continuous variables

**Working Example Video:**
```python
import matplotlib.pyplot as plt
import numpy as np

# Sample time-series data
months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
revenue = [45000, 52000, 48000, 61000, 58000, 65000]

# Simple line chart
plt.figure(figsize=(10, 6))
plt.plot(months, revenue, marker='o', linewidth=2, color='#0284c7')
plt.title('Monthly Revenue Trend', fontsize=14, fontweight='bold')
plt.xlabel('Month', fontsize=12)
plt.ylabel('Revenue ($)', fontsize=12)
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('revenue_trend.png', dpi=300)
plt.show()

# Multiple lines (compare regions)
plt.figure(figsize=(10, 6))
north = [40000, 48000, 45000, 55000, 52000, 60000]
south = [50000, 56000, 51000, 66000, 64000, 70000]

plt.plot(months, north, marker='o', label='North', linewidth=2)
plt.plot(months, south, marker='s', label='South', linewidth=2)
plt.title('Revenue by Region', fontsize=14, fontweight='bold')
plt.xlabel('Month', fontsize=12)
plt.ylabel('Revenue ($)', fontsize=12)
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()

# Area chart (stacked)
plt.figure(figsize=(10, 6))
plt.stackplot(range(len(months)), north, south, 
              labels=['North', 'South'], alpha=0.7)
plt.title('Revenue Stacked by Region', fontsize=14, fontweight='bold')
plt.xticks(range(len(months)), months)
plt.ylabel('Revenue ($)', fontsize=12)
plt.legend(loc='upper left')
plt.tight_layout()
plt.show()
```

**Key Takeaway:** Line charts show trends. Use markers and legends for clarity.

---

#### 4.2 Bar and Histogram Charts
**Concept:** Compare categories or show distributions

**Working Example Video:**
```python
import matplotlib.pyplot as plt
import numpy as np

# Categorical comparison (Bar chart)
departments = ['Sales', 'Engineering', 'HR', 'Finance']
headcount = [45, 52, 15, 22]
colors = ['#0284c7', '#10b981', '#f59e0b', '#ef4444']

plt.figure(figsize=(10, 6))
bars = plt.bar(departments, headcount, color=colors, alpha=0.8)

# Add value labels on bars
for bar, value in zip(bars, headcount):
    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
             str(value), ha='center', va='bottom', fontweight='bold')

plt.title('Headcount by Department', fontsize=14, fontweight='bold')
plt.ylabel('Number of Employees', fontsize=12)
plt.grid(True, axis='y', alpha=0.3)
plt.tight_layout()
plt.show()

# Horizontal bar chart (for long labels)
plt.figure(figsize=(10, 6))
plt.barh(departments, headcount, color=colors, alpha=0.8)
plt.title('Headcount by Department', fontsize=14, fontweight='bold')
plt.xlabel('Number of Employees', fontsize=12)
plt.grid(True, axis='x', alpha=0.3)
plt.tight_layout()
plt.show()

# Histogram (distribution of a continuous variable)
salaries = np.random.normal(loc=75000, scale=15000, size=1000)

plt.figure(figsize=(10, 6))
plt.hist(salaries, bins=30, color='#0284c7', edgecolor='black', alpha=0.7)
plt.title('Salary Distribution', fontsize=14, fontweight='bold')
plt.xlabel('Salary ($)', fontsize=12)
plt.ylabel('Frequency', fontsize=12)
plt.axvline(np.mean(salaries), color='red', linestyle='--', linewidth=2, label=f'Mean: ${np.mean(salaries):,.0f}')
plt.axvline(np.median(salaries), color='green', linestyle='--', linewidth=2, label=f'Median: ${np.median(salaries):,.0f}')
plt.legend()
plt.grid(True, axis='y', alpha=0.3)
plt.tight_layout()
plt.show()
```

**Key Takeaway:** Bar charts compare categories. Histograms show data distribution.

---

#### 4.3 Scatter Plots and Correlation
**Concept:** Visualize relationship between two continuous variables

**Working Example Video:**
```python
import matplotlib.pyplot as plt
import numpy as np

# Sample data: salary vs. years of experience
years = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
salary = np.array([45000, 48000, 52000, 56000, 61000, 65000, 70000, 75000, 80000, 85000])

plt.figure(figsize=(10, 6))
plt.scatter(years, salary, s=100, alpha=0.6, color='#0284c7', edgecolor='black')

# Fit a trend line
z = np.polyfit(years, salary, 1)
p = np.poly1d(z)
plt.plot(years, p(years), "r--", linewidth=2, label=f'Trend: y={z[0]:.0f}x+{z[1]:.0f}')

plt.title('Salary vs. Years of Experience', fontsize=14, fontweight='bold')
plt.xlabel('Years of Experience', fontsize=12)
plt.ylabel('Salary ($)', fontsize=12)
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()

# Color-coded scatter plot (3 variables)
np.random.seed(42)
size_sales = np.random.randint(10, 1000, 50)
size_commissions = np.random.randint(1000, 10000, 50)
size_departments = np.random.choice(['Sales', 'Support', 'Engineer'], 50)

colors_map = {'Sales': '#0284c7', 'Support': '#10b981', 'Engineer': '#f59e0b'}
colors = [colors_map[d] for d in size_departments]

plt.figure(figsize=(10, 6))
plt.scatter(size_sales, size_commissions, s=100, c=colors, alpha=0.6, edgecolor='black')

# Add legend for colors
for dept, color in colors_map.items():
    plt.scatter([], [], c=color, s=100, label=dept, alpha=0.6)

plt.title('Sales vs. Commission by Department', fontsize=14, fontweight='bold')
plt.xlabel('Sales Generated', fontsize=12)
plt.ylabel('Commission Earned ($)', fontsize=12)
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()
```

**Key Takeaway:** Scatter plots reveal correlations and outliers. Use color for a third variable.

---

#### 4.4 Subplots and Multi-Panel Layouts
**Concept:** Combine multiple plots for side-by-side comparison

**Working Example Video:**
```python
import matplotlib.pyplot as plt
import numpy as np

# Sample data
months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
north_sales = [40000, 48000, 45000, 55000, 52000, 60000]
south_sales = [50000, 56000, 51000, 66000, 64000, 70000]

# Create a 2x2 grid of subplots
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# Subplot 1: Line chart (top-left)
axes[0, 0].plot(months, north_sales, marker='o', linewidth=2, color='#0284c7', label='North')
axes[0, 0].plot(months, south_sales, marker='s', linewidth=2, color='#ef4444', label='South')
axes[0, 0].set_title('Regional Sales Trend', fontweight='bold')
axes[0, 0].set_ylabel('Sales ($)')
axes[0, 0].legend()
axes[0, 0].grid(True, alpha=0.3)

# Subplot 2: Bar chart (top-right)
departments = ['Sales', 'Eng', 'HR', 'Finance']
headcount = [45, 52, 15, 22]
axes[0, 1].bar(departments, headcount, color=['#0284c7', '#10b981', '#f59e0b', '#ef4444'], alpha=0.8)
axes[0, 1].set_title('Headcount by Department', fontweight='bold')
axes[0, 1].set_ylabel('Employees')
axes[0, 1].grid(True, axis='y', alpha=0.3)

# Subplot 3: Histogram (bottom-left)
salaries = np.random.normal(loc=75000, scale=15000, size=1000)
axes[1, 0].hist(salaries, bins=30, color='#0284c7', alpha=0.7, edgecolor='black')
axes[1, 0].set_title('Salary Distribution', fontweight='bold')
axes[1, 0].set_xlabel('Salary ($)')
axes[1, 0].set_ylabel('Frequency')
axes[1, 0].grid(True, axis='y', alpha=0.3)

# Subplot 4: Scatter plot (bottom-right)
years = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
salary = np.array([45000, 48000, 52000, 56000, 61000, 65000, 70000, 75000, 80000, 85000])
axes[1, 1].scatter(years, salary, s=100, alpha=0.6, color='#0284c7', edgecolor='black')
axes[1, 1].set_title('Salary vs. Experience', fontweight='bold')
axes[1, 1].set_xlabel('Years')
axes[1, 1].set_ylabel('Salary ($)')
axes[1, 1].grid(True, alpha=0.3)

# Overall title and layout
fig.suptitle('Company Analytics Dashboard', fontsize=16, fontweight='bold', y=1.00)
plt.tight_layout()
plt.savefig('dashboard.png', dpi=300, bbox_inches='tight')
plt.show()
```

**Key Takeaway:** Subplots enable story-telling. Arrange multiple views for impact.

---

#### 4.5 Customization and Export
**Concept:** Polish plots for presentations and reports

**Working Example Video:**
```python
import matplotlib.pyplot as plt
import numpy as np

# Create a professional-looking plot
plt.figure(figsize=(12, 7))

# Data
months = np.arange(1, 13)
revenue = np.random.uniform(40000, 70000, 12)

# Plot with custom styling
plt.plot(months, revenue, marker='o', markersize=8, linewidth=3, 
         color='#0284c7', label='Revenue', zorder=2)

# Customize axes
plt.xlabel('Month', fontsize=13, fontweight='bold')
plt.ylabel('Revenue ($)', fontsize=13, fontweight='bold')
plt.title('2024 Monthly Revenue Report', fontsize=15, fontweight='bold', pad=20)
plt.xticks(months, [f'M{i}' for i in months], fontsize=11)
plt.yticks(fontsize=11)

# Add grid
plt.grid(True, linestyle='--', alpha=0.4, linewidth=0.7)
plt.gca().set_axisbelow(True)

# Add shading
plt.fill_between(months, revenue, alpha=0.2, color='#0284c7')

# Format y-axis as currency
ax = plt.gca()
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x/1000:.0f}K'))

# Add legend
plt.legend(fontsize=12, loc='upper left')

# Tight layout prevents label cutoff
plt.tight_layout()

# Export in multiple formats
plt.savefig('revenue_report.png', dpi=300, bbox_inches='tight')  # PNG
plt.savefig('revenue_report.pdf', dpi=300, bbox_inches='tight')  # PDF
plt.savefig('revenue_report.svg', dpi=300, bbox_inches='tight')  # SVG (for editing)

print("Plot saved as PNG, PDF, and SVG")
plt.show()
```

**Key Takeaway:** Polish matters. Use consistent fonts, colors, and formats for professional output.

---

**Section 4 Success Checkpoint:**
- ✅ Create line charts for trends
- ✅ Build bar and histograms for categories and distributions
- ✅ Make scatter plots to explore correlations
- ✅ Arrange subplots for multi-panel comparisons
- ✅ Customize and export plots in multiple formats

---

### Section 5: Teach-First Flow (Reinforcement)
**Topics:** Concept lesson → guided code walkthrough → practice task → checkpoint

---

#### 5.1 Concept Lesson: Understanding the Why
**Concept:** Learn principles with real-world analogies before touching code

**Working Example Video:**
**Topic:** "Understanding Data Types in NumPy"

```
Why NumPy Arrays Over Python Lists?

ANALOGY: Imagine you're a warehouse manager.
- Python lists are like cardboard boxes where items can be anything.
  You have to check each item individually. Slow.
- NumPy arrays are like organized shelves where all items are identical (same type).
  You can move the whole shelf at once. Fast.

Real-world impact:
✓ NumPy arrays are 10-100x faster for numerical operations
✓ They use less memory (homogeneous types)
✓ They enable vectorization (no explicit loops)
✓ They're the foundation of every ML library (Pandas, Scikit-learn, PyTorch)

When to use:
→ Always for numerical/tabular data
→ When speed matters (>10,000 rows)
→ When you need mathematical operations

Common pitfall:
✗ Forgetting that arrays are mutable. Changes affect the original!
```

**Key Takeaway:** Conceptual understanding = confidence + retention.

---

#### 5.2 Guided Code Walkthrough: See It Working
**Concept:** Step-by-step annotated code with output at each checkpoint

**Working Example Video:**
**Topic:** "Merging Two DataFrames in Pandas"

```python
import pandas as pd

# Step 1: Load sample data
employees = pd.DataFrame({
    'emp_id': [101, 102, 103],
    'name': ['Alice', 'Bob', 'Carol'],
    'dept_id': [10, 20, 10]
})
print("Employees DataFrame:")
print(employees)
# Output:
#   emp_id  name  dept_id
#0     101 Alice       10
#1     102   Bob       20
#2     103 Carol       10

departments = pd.DataFrame({
    'dept_id': [10, 20, 30],
    'dept_name': ['Sales', 'Engineering', 'HR']
})
print("\nDepartments DataFrame:")
print(departments)
# Output:
#   dept_id      dept_name
#0       10          Sales
#1       20   Engineering
#2       30              HR

# Step 2: Inner join (only matching records)
result_inner = pd.merge(employees, departments, on='dept_id', how='inner')
print("\nInner join (only Sales & Engineering employees):")
print(result_inner)
# Output:
#   emp_id name  dept_id      dept_name
#0     101 Alice       10          Sales
#1     102   Bob       20   Engineering
#2     103 Carol       10          Sales

# Step 3: Left join (keep all employees)
result_left = pd.merge(employees, departments, on='dept_id', how='left')
print("\nLeft join (all employees, even if HR doesn't exist):")
print(result_left)
# Output:
#   emp_id   name  dept_id      dept_name
#0     101  Alice       10          Sales
#1     102    Bob       20   Engineering
#2     103  Carol       10          Sales

# Step 4: Verify the merge
print(f"\nMerge summary:")
print(f"Original employees: {len(employees)}")
print(f"Original departments: {len(departments)}")
print(f"After inner join: {len(result_inner)}")
print(f"After left join: {len(result_left)}")
```

**Key Takeaway:** Walk through realistic code. Show inputs, outputs, and interpretations.

---

#### 5.3 Practice Task: Hands-On Application
**Concept:** Similar but distinct scenario where learners apply the concept independently

**Working Example Video:**
**Topic:** "Your Turn: Merge Customer Transactions with Product Info"

```
TASK DESCRIPTION:
You have two DataFrames:
- transactions: customer_id, product_id, amount
- products: product_id, product_name, category

Perform a left join to get transaction details with product names.
Add a new column 'profit_margin' that is 30% of the amount.

STARTER CODE (incomplete):
import pandas as pd

transactions = pd.DataFrame({
    'trans_id': [1, 2, 3, 4],
    'customer_id': [101, 102, 101, 103],
    'product_id': [1, 2, 1, 3],
    'amount': [100, 150, 200, 75]
})

products = pd.DataFrame({
    'product_id': [1, 2, 3],
    'product_name': ['Laptop', 'Monitor', 'Keyboard'],
    'category': ['Electronics', 'Electronics', 'Accessories']
})

# Your task: Complete these steps
# 1. Merge transactions with products (left join on product_id)
# 2. Calculate profit_margin as 30% of amount
# 3. Print the merged DataFrame
# 4. Print total revenue by category

# HINT: Use pd.merge(..., how='left')

EXPECTED OUTPUT:
   trans_id  customer_id  product_id  amount product_name     category  profit_margin
0         1          101           1     100       Laptop  Electronics            30
1         2          102           2     150      Monitor  Electronics            45
2         3          101           1     200       Laptop  Electronics            60
3         4          103           3      75      Keyboard  Accessories          22.5

category
Accessories       22.5
Electronics      135.0
Name: profit_margin, dtype: float64

SUCCESS CRITERIA:
✓ Merge completed with all rows from transactions
✓ Product names and categories correctly aligned
✓ Profit_margin calculated as 0.3 * amount
✓ Grouping by category shows correct totals
```

**Key Takeaway:** Practice ≠ memorization. It's applying the concept to new data.

---

#### 5.4 Checkpoint: Validate Understanding
**Concept:** Quick quiz to confirm mastery before moving on

**Working Example Video:**
**Topic:** "Checkpoint: NumPy Vectorization Mastery"

```
QUESTION 1: Which of the following is the main advantage of NumPy arrays?
A) They are easier to read than Python lists
B) They enable fast, vectorized operations without explicit loops
C) They automatically clean missing data
D) They can store any data type mixed together

ANSWER: B ✓
EXPLANATION: NumPy's strength is speed through vectorization. 
When you do arr * 2, NumPy computes all multiplications at once 
(in optimized C code), while a Python loop would iterate one-by-one.

---

QUESTION 2: What does this code return?
```python
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
result = arr[arr > 2]
```

A) [3, 4, 5]
B) [False, False, True, True, True]
C) 3
D) Error

ANSWER: A ✓
EXPLANATION: arr > 2 creates a boolean array [F, F, T, T, T].
Using arr[boolean_array] returns only elements where True.
So you get [3, 4, 5].

---

QUESTION 3: After running this merge, how many rows do you expect?
```python
left_df = pd.DataFrame({'id': [1, 2, 3], 'name': ['A', 'B', 'C']})
right_df = pd.DataFrame({'id': [1, 2, 4], 'value': [10, 20, 30]})
result = pd.merge(left_df, right_df, on='id', how='left')
```

A) 2 rows (only matching ids)
B) 3 rows (all from left)
C) 4 rows (all unique ids)
D) Error

ANSWER: B ✓
EXPLANATION: Left join keeps all rows from the left DataFrame.
Even though id=3 has no match in right_df, it stays (with NaN for 'value').
Result: id [1, 2, 3] with value [10, 20, NaN].

---

RESULTS: 3/3 Correct! ✓
You are ready to move to the next section.
```

**Key Takeaway:** Checkpoints validate readiness. Immediate feedback builds confidence.

---

**Section 5 Success Checkpoint (Module Complete):**
- ✅ Understood core concepts via analogies and real-world context
- ✅ Followed guided code walkthroughs with annotated output
- ✅ Applied concepts to practice tasks independently
- ✅ Validated understanding with multiple-choice questions
- ✅ Received immediate feedback on all answers

---

**Integrated Capstone Project: End-to-End Data Science Workflow**

Now that you've mastered all five sections, apply them to a real scenario:

**The Task:**
Given a CSV with employee data (name, salary, department, hire_date, performance_score), you will:

1. **Load & Explore** (Section 1-3)
   ```python
   import pandas as pd
   import numpy as np
   
   df = pd.read_csv('employees.csv')
   print(df.info())
   print(df.describe())
   print(df.isnull().sum())
   ```

2. **Clean & Transform** (Section 3)
   ```python
   # Handle missing salaries with median by department
   df['salary'].fillna(df.groupby('department')['salary'].transform('median'), inplace=True)
   
   # Calculate years of service
   df['years_service'] = (pd.Timestamp.now() - df['hire_date']).dt.days / 365.25
   ```

3. **Analyze & Aggregate** (Section 2-3)
   ```python
   # Average salary by department
   dept_salaries = df.groupby('department').agg({
       'salary': ['mean', 'min', 'max'],
       'performance_score': 'mean'
   })
   
   # Identify top performers
   top_performers = df[df['performance_score'] >= 4.0].sort_values('salary', ascending=False)
   ```

4. **Visualize** (Section 4)
   ```python
   import matplotlib.pyplot as plt
   
   fig, axes = plt.subplots(2, 2, figsize=(14, 10))
   
   # Plot 1: Salary distribution by department
   df.boxplot(column='salary', by='department', ax=axes[0, 0])
   
   # Plot 2: Performance vs. Salary scatter
   axes[0, 1].scatter(df['salary'], df['performance_score'])
   
   # Plot 3: Tenure distribution histogram
   axes[1, 0].hist(df['years_service'], bins=20)
   
   # Plot 4: Headcount by department
   axes[1, 1].bar(df['department'].value_counts().index, 
                   df['department'].value_counts().values)
   
   plt.suptitle('Employee Analytics Dashboard', fontsize=16, fontweight='bold')
   plt.tight_layout()
   plt.savefig('employee_dashboard.png', dpi=300)
   ```

5. **Interpret & Report**
   Write 3-5 bullet points summarizing insights:
   - Which department has the highest average salary?
   - Is there a correlation between tenure and performance?
   - What % of employees are top performers?
   - Which departments should you focus on for salary reviews?

**Success Criteria:**
- ✅ Code runs without errors
- ✅ All missing values handled
- ✅ At least one groupby aggregation
- ✅ At least one visualization
- ✅ 3+ insights documented

---

## Integrated Example: Hands-On Project

**The Task:**
Given a CSV with employee data (salary, department, years, performance score), students will:

1. **Load & Explore** (NumPy, Pandas)
   - Load the CSV
   - Inspect shape, dtypes, nulls
   - Compute summary stats

2. **Clean** (Pandas)
   - Handle missing salary values (imputation or removal decision)
   - Remove duplicates
   - Detect outliers in performance scores

3. **Analyze** (NumPy, Pandas)
   - Group by department
   - Calculate average salary per department
   - Rank employees by performance-to-salary ratio

4. **Visualize** (Matplotlib)
   - Bar chart: average salary by department
   - Scatter plot: salary vs. performance (colored by department)
   - Histogram: distribution of years of service

5. **Interpret**
   - Write 2–3 sentence insights from the plots
   - Recommend which departments might need salary reviews

This project reinforces all five sections in a realistic, repeatable workflow.

---

## Success Criteria

By the end of this course, students can:

✅ Write clean, reusable Python functions  
✅ Load and reshape data with Pandas without hesitation  
✅ Spot missing values and choose appropriate fixes  
✅ Compute aggregate statistics and comparisons  
✅ Create publication-quality visualizations  
✅ Explain their findings to non-technical stakeholders  

✅ **Most importantly:** Start with raw data and end with insights—before touching a machine learning library.

---

## Recommended Follow-Up Courses

- **SQL & Data Analysis** — Query databases directly
- **Applied Data Science** — Build predictive models
- **Advanced Excel** — Parallel skills for stakeholder communication
- **Data Visualization with Matplotlib & Seaborn** — Next-level storytelling
