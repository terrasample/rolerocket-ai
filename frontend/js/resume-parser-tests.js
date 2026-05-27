// Resume Parser Test Suite - 15 Different Resume Formats
// Test file to identify parsing issues

const testResumes = [
  {
    name: "Resume 1: Zallema's Original Resume",
    text: `Zallema Adalsha (r)rt(arrt)
project manager

CONTACT
646-285-5540
zal.adalsha@gmail.com
4408 McCarty Road, Fort Pierce, FL 34945

SKILLS
Good Samaritan Medical Center
1/2021-11/2023
Diagnostic Supervisor
Manage and coordinate daily exam schedule for Operating Room, diagnostic studies, and Invasive studies
Create and maintain department staff daily work schedule, daily staff assignment, monthly work schedule, as well as call schedule
Establish staffing needs based on peak volume hours!
Manage imaging equipment maintenance, to correlate with yearly inspections/audits
Collaborate with radiologist and director to manage and maintain policies and protocols
Interview all candidates as well as Orient and onboard new team members
Daily coding in Kronos payroll system, approving employee hours and request
Proficient in RIS/HIS systems (Centricity PACS, McKesson PACS, Cerner, Meditech), Proficient in Microsoft Outlook, Excel, and Word
Knowledge of envision Connect applications`
  },
  {
    name: "Resume 2: Standard Format with Clear Sections",
    text: `John Smith
Senior Software Engineer

CONTACT
(555) 123-4567
john.smith@email.com
San Francisco, CA

PROFILE
Experienced Senior Software Engineer with 8+ years developing scalable web applications using React, Node.js, and cloud platforms. Proven track record delivering high-performance solutions for Fortune 500 companies.

EXPERIENCE
Senior Software Engineer
TechCorp Inc., San Francisco, CA | Jan 2021 - Present
• Architected microservices infrastructure reducing deployment time by 40%
• Led team of 6 engineers delivering 3 major product releases
• Implemented CI/CD pipeline increasing deployment frequency by 5x

Software Engineer
DataFlow Systems, Austin, TX | Jun 2018 - Dec 2020
• Designed and implemented real-time data processing pipeline handling 1M+ events/second
• Reduced system latency by 60% through database optimization
• Mentored 2 junior engineers on best practices

SKILLS
React, Node.js, Python, AWS, Docker, Kubernetes, PostgreSQL, MongoDB, GraphQL, Git, Agile, TDD`
  },
  {
    name: "Resume 3: No Experience Section Header",
    text: `Maria Garcia
Marketing Director

CONTACT
maria.garcia@email.com
(555) 987-6543
New York, NY

PROFILE
Results-driven Marketing Director with 10 years of experience leading digital transformation initiatives.

Marketing Director
Global Tech Solutions | Jan 2020 - Present
• Launched digital marketing strategy resulting in 45% increase in qualified leads
• Managed marketing budget of $2.5M across 15 campaigns
• Built and mentored team of 8 marketing specialists

Marketing Manager
Creative Innovations LLC | Mar 2017 - Dec 2019
• Developed content strategy increasing website traffic by 200%
• Led rebranding initiative for 3 major product lines
• Coordinated with cross-functional teams on product launches

SKILLS
Digital Marketing, Content Strategy, Budget Management, Team Leadership, Adobe Creative Suite, Google Analytics`
  },
  {
    name: "Resume 4: Multiple Certifications and Degrees",
    text: `Dr. Robert Johnson
Healthcare Administrator

CONTACT
robert.johnson@hospital.org
(555) 222-3333
Boston, MA 02101

EDUCATION
Doctor of Business Administration (DBA)
Harvard Business School, Boston, MA | 2018
Master of Health Administration (MHA)
University of Michigan, Ann Arbor, MI | 2014
Bachelor of Science in Biology
State University, New York, NY | 2011

CERTIFICATIONS
FACHE (Fellow, American College of Healthcare Executives)
Six Sigma Black Belt
Project Management Professional (PMP)

EXPERIENCE
Healthcare Administrator
Boston Medical Center | 2019 - Present
• Oversee operations for 500-bed teaching hospital with $200M annual budget
• Implemented lean process improvements saving $5M annually
• Led Joint Commission accreditation achieving 98% compliance

Operations Manager
Regional Health Network | 2014 - 2018
• Managed 25 clinical departments and 400+ staff members
• Improved patient satisfaction scores from 72% to 89%`
  },
  {
    name: "Resume 5: Informal Skills Listed",
    text: `Alex Rodriguez
Production Supervisor

EXPERIENCE
Production Supervisor
Manufacturing Corp, Detroit, MI | 2020 - Now
Good at managing people
Works well with equipment maintenance
Fast problem solver
Knows how to schedule shifts
Experience with inventory tracking
Some forklift certification
Good communicator
Team player

SKILLS
People management, Team player, Communication, Problem solving, Forklift operation, Inventory management`
  },
  {
    name: "Resume 6: Very Old Jobs (2005-2008)",
    text: `Patricia Wilson
Accountant

EXPERIENCE
Senior Accountant
Acme Financial Services | Jan 2005 - Dec 2008
Managed monthly account reconciliation
Prepared quarterly financial statements
Trained new accounting staff members
Implemented new accounting software system

Staff Accountant
Miller & Associates, CPA | Jun 2002 - Dec 2004
Prepared tax returns for small business clients
Maintained general ledger accounts
Assisted with audit preparations`
  },
  {
    name: "Resume 7: Mix of Tenses in Same Job",
    text: `Michael Chen
Project Coordinator

EXPERIENCE
Project Coordinator
BuildRight Construction | Feb 2022 - Present
• Coordinating site schedules with subcontractors
• Tracks project budget and expenses
• Communicated weekly status updates with stakeholders
• Managing vendor relationships and procurement

Assistant Coordinator
BuildRight Construction | Jan 2020 - Jan 2022
• Assisted with scheduling coordination
• Prepared meeting agendas and took minutes
• Coordinating with various departments`
  },
  {
    name: "Resume 8: Job Titles in Lowercase",
    text: `Jennifer Davis
professional educator

EXPERIENCE
senior math teacher
Lincoln High School | 2019 - Present
• leading algebra and geometry classes for 200+ students
• developing innovative curriculum incorporating technology
• mentoring 5 junior teachers on classroom management

middle school science teacher
Washington Middle School | 2015 - 2018
• taught earth science and biology to diverse learners
• organized annual science fair with 150+ participants`
  },
  {
    name: "Resume 9: Company Names as Bullets",
    text: `David Thompson
Consultant

SKILLS
Microsoft Corporation
IBM Global Services
Accenture
Deloitte Consulting
McKinsey & Company
Goldman Sachs
JPMorgan Chase

Proficient in Excel, PowerPoint, Project Management, Data Analysis, Strategic Planning, Client Relations`
  },
  {
    name: "Resume 10: Inline Dates in Skills Section",
    text: `Sarah Johnson
Quality Engineer

SKILLS
Quality Assurance 01/2021-Present
Testing Automation (Java, Python) 06/2019-12/2023
Manual Testing Procedures 03/2018-05/2021
Requirements Analysis 01/2019-Present
Test Case Development 2015-2020
Risk Assessment Tools 2014-2017`
  },
  {
    name: "Resume 11: Weird Formatting with Extra Spaces",
    text: `Thomas Anderson
Operations Manager

CONTACT
thomas.anderson@company.com          (555) 456-7890          Chicago, IL

EXPERIENCE

Operations Manager
SuperCorp Industries          Jan 2021 - Present
     • Oversee daily operations of 3 regional facilities
     • Manage team of 50+ employees across multiple departments
     • Implemented cost-saving initiatives resulting in 15% reduction


Assistant Operations Manager
MidSize Corp          Jun 2018 - Dec 2020
     • Supported regional operations director
     • Coordinated with finance on budget allocations
     • Trained new staff on operational procedures`
  },
  {
    name: "Resume 12: Experience with Month-Year Ranges",
    text: `Linda Martinez
Financial Analyst

EXPERIENCE
Senior Financial Analyst
Global Finance Inc., New York, NY | November 2021 – September 2023
• Analyzed investment portfolios worth $500M+
• Generated monthly financial reports for executive team
• Implemented forecasting models

Junior Financial Analyst
StartUp Finance Co., Boston, MA | March 2019 – October 2021
• Supported senior analysts on research projects
• Compiled data for quarterly earnings reports`
  },
  {
    name: "Resume 13: No Clear Job Titles",
    text: `Chris Brown

EXPERIENCE
2022 - Present, Remote Position
Working on multiple projects for various clients
Developing software solutions
Meeting with stakeholders regularly
Troubleshooting issues as they arise
Learning new technologies on the job

2019 - 2021
Consulting Role at Various Companies
Helped with business analysis
Supported project management efforts
Coordinated with team members`
  },
  {
    name: "Resume 14: Credential Suffixes on Name",
    text: `Dr. Amanda Foster, PhD, PMP, CISSP
Cybersecurity Director

EXPERIENCE
Director of Cybersecurity
TechSecure Corp | 2021 - Present
• Leading cybersecurity team of 15 professionals
• Architecting enterprise security framework
• Managed security incident response

Senior Security Engineer
InfoProtect LLC | 2018 - 2020
• Designed and implemented security systems
• Conducted vulnerability assessments`
  },
  {
    name: "Resume 15: Only Company Names with Dates (No Job Titles)",
    text: `Kevin Lee

EXPERIENCE
Acme Corporation  2020 - Present
Senior roles in operations
Led multiple teams
Managed budgets over $1M

TechStart Inc  2017 - 2019
Various technical responsibilities
Supported product development
Collaborated with other departments

GlobalCo Ltd  2015 - 2016
Contract position
Assisted with project work`
  }
];

// Test parser
console.log("Testing Resume Parser with 15 Different Formats\n");
console.log("==================================================\n");

testResumes.forEach((resume, index) => {
  console.log(`\n### Test ${index + 1}: ${resume.name}`);
  console.log("---");
  
  // Log what the parser would extract (simulated based on current logic)
  const lines = resume.text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Find sections
  const skillsIdx = lines.findIndex(l => /^\s*SKILLS\b/i.test(l));
  const experienceIdx = lines.findIndex(l => /^\s*EXPERIENCE\b/i.test(l));
  const profileIdx = lines.findIndex(l => /^\s*PROFILE\b/i.test(l));
  
  console.log(`Name Found: ${lines[0]}`);
  
  if (skillsIdx >= 0) {
    console.log(`Skills Section Found at Line ${skillsIdx}`);
    const skillsLines = lines.slice(skillsIdx + 1, experienceIdx >= 0 ? experienceIdx : lines.length);
    console.log(`Parsed Skills: ${skillsLines.join(', ')}`);
  }
  
  if (experienceIdx >= 0) {
    console.log(`Experience Section Found at Line ${experienceIdx}`);
    const expLines = lines.slice(experienceIdx + 1);
    console.log(`First 5 Experience Lines:`);
    expLines.slice(0, 5).forEach(l => console.log(`  - ${l}`));
  }
  
  // Issues to check
  console.log("\nPotential Issues:");
  
  // Check for company names in skills
  if (skillsIdx >= 0) {
    const skillsLines = lines.slice(skillsIdx + 1, experienceIdx >= 0 ? experienceIdx : lines.length);
    const hasCompanyNames = skillsLines.some(l => /Center|Corporation|Corp|Inc|LLC|Company|Services/i.test(l));
    if (hasCompanyNames) console.log("  ❌ Company names detected in skills section");
  }
  
  // Check for job titles in lowercase
  if (experienceIdx >= 0) {
    const expLines = lines.slice(experienceIdx + 1);
    const lowercaseJobTitle = expLines.find(l => /^[a-z]/.test(l) && !/^•|-|\*/.test(l));
    if (lowercaseJobTitle) console.log(`  ❌ Job title in lowercase: "${lowercaseJobTitle}"`);
  }
  
  // Check for job descriptions as skills
  if (skillsIdx >= 0) {
    const skillsLines = lines.slice(skillsIdx + 1, experienceIdx >= 0 ? experienceIdx : lines.length);
    const hasDescriptions = skillsLines.some(l => /manage|coordinate|maintain|create|lead|develop|implement/i.test(l) && l.length > 30);
    if (hasDescriptions) console.log("  ❌ Job descriptions detected in skills section");
  }
});
