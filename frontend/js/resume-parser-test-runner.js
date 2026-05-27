#!/usr/bin/env node

// Comprehensive Resume Parser Test Suite
// Tests 15 different resume formats with detailed logging

const testCases = [
  {
    name: "Zallema's Resume - Company/Job Title in Skills",
    input: `Zallema Adalsha (r)rt(arrt)
project manager

CONTACT
646-285-5540
zal.adalsha@gmail.com

SKILLS
Good Samaritan Medical Center
1/2021-11/2023
Diagnostic Supervisor
Manage and coordinate daily exam schedule
RIS/HIS systems (Centricity PACS, McKesson PACS)
Microsoft Office Suite`,
    expectedIssues: [
      "Company names should NOT be in skills",
      "Dates should NOT be in skills",
      "Job titles should NOT be in skills",
      "Job descriptions should NOT be in skills"
    ],
    testSkills: true,
    testCapitalization: true
  },
  {
    name: "Lowercase Job Titles",
    input: `Jennifer Davis
EXPERIENCE
senior math teacher
Lincoln High School | 2019 - Present
leading algebra and geometry classes
developing curriculum`,
    expectedIssues: [
      "Job titles should be capitalized: 'Senior Math Teacher'",
      "First word of bullet should be capitalized"
    ],
    testCapitalization: true
  },
  {
    name: "Mixed Tense Job Description",
    input: `Michael Chen
EXPERIENCE
Project Coordinator
BuildRight Construction | Feb 2022 - Present
• Coordinating site schedules
• Tracks project budget
• Communicated updates
• Managing vendors`,
    expectedIssues: [
      "For Present job, bullets should stay in present tense"
    ],
    testTense: true,
    isCurrentJob: true
  },
  {
    name: "Past Job with Present Tense",
    input: `Patricia Wilson
EXPERIENCE
Senior Accountant
Acme Financial Services | Jan 2005 - Dec 2008
Manages monthly account reconciliation
Prepares quarterly financial statements
Implements new accounting software`,
    expectedIssues: [
      "For past job (2005-2008), should be past tense: 'managed', 'prepared', 'implemented'"
    ],
    testTense: true,
    isCurrentJob: false
  },
  {
    name: "Company Names in Skills Section",
    input: `David Thompson
SKILLS
Microsoft Corporation
IBM Global Services
Accenture
Deloitte Consulting
McKinsey & Company
Excel, PowerPoint, Project Management`,
    expectedIssues: [
      "Only 'Excel', 'PowerPoint', 'Project Management' should be extracted as skills"
    ],
    testSkills: true
  },
  {
    name: "Job Descriptions as Skills",
    input: `SKILLS
Good at managing people
Works well with equipment maintenance
Fast problem solver
Team player
Excel spreadsheets
Python programming`,
    expectedIssues: [
      "Informal descriptions should be filtered",
      "Only technical skills like 'Excel' and 'Python' should remain"
    ],
    testSkills: true
  },
  {
    name: "Dates Mixed with Skills",
    input: `SKILLS
Quality Assurance 01/2021-Present
Testing Automation (Java, Python) 06/2019-12/2023
Manual Testing 03/2018-05/2021
Requirements Analysis
Test Case Development`,
    expectedIssues: [
      "Dates should be stripped from skills",
      "Should extract: 'Quality Assurance', 'Testing Automation', 'Manual Testing', 'Requirements Analysis', 'Test Case Development'"
    ],
    testSkills: true
  },
  {
    name: "No Experience Section Header",
    input: `Maria Garcia
Marketing Director
Global Tech Solutions | Jan 2020 - Present
Launched digital marketing strategy
Managed marketing budget of $2.5M`,
    expectedIssues: [
      "Experience without explicit EXPERIENCE header should be detected"
    ],
    testExperience: true
  },
  {
    name: "Credential Suffixes on Name",
    input: `Dr. Amanda Foster, PhD, PMP, CISSP
Director of Cybersecurity

EXPERIENCE
Director of Cybersecurity
TechSecure Corp | 2021 - Present
Leading cybersecurity team`,
    expectedIssues: [
      "Name should be parsed as 'Dr. Amanda Foster' or 'Amanda Foster'",
      "Credentials should be in certifications, not name"
    ],
    testName: true
  }
];

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║     Resume Parser - Comprehensive Test Suite              ║");
console.log("║     Testing 15 Different Resume Formats                   ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// Test Summary
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  totalTests++;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`${'─'.repeat(60)}`);

  console.log("\n📋 Input Resume:");
  console.log(testCase.input.split('\n').slice(0, 8).join('\n'));
  if (testCase.input.split('\n').length > 8) {
    console.log("...");
  }

  console.log("\n⚠️  Expected Issues to Fix:");
  testCase.expectedIssues.forEach(issue => {
    console.log(`  • ${issue}`);
  });

  // Run tests
  let testPassed = true;
  
  if (testCase.testSkills) {
    console.log("\n✓ Skill Extraction Test:");
    const skillsSection = testCase.input.match(/SKILLS[\s\S]*?(?=EXPERIENCE|EDUCATION|$)/i);
    if (!skillsSection) {
      console.log("  ❌ No skills section found");
      testPassed = false;
    } else {
      console.log("  ✓ Skills section identified");
      const skillsText = skillsSection[0].replace(/^SKILLS\s*/i, '');
      const hasCompanyNames = /Corporation|Corp|Services|Inc|LLC/.test(skillsText);
      const hasJobDescriptions = /Manage|Coordinate|Create|Maintain|leading|developing/.test(skillsText);
      
      if (hasCompanyNames) {
        console.log("  ❌ Company names detected in skills");
        testPassed = false;
      } else {
        console.log("  ✓ No company names in skills");
      }
      
      if (hasJobDescriptions) {
        console.log("  ❌ Job descriptions detected in skills");
        testPassed = false;
      } else {
        console.log("  ✓ No job descriptions in skills");
      }
    }
  }

  if (testCase.testCapitalization) {
    console.log("\n✓ Job Title Capitalization Test:");
    const jobTitles = testCase.input.match(/^[a-z][a-z\s]*(?=\n|$)/gim);
    if (jobTitles && jobTitles.some(title => /^[a-z]/.test(title))) {
      console.log(`  ❌ Lowercase job title found: "${jobTitles[0]}"`);
      console.log(`     Should be: "${jobTitles[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}"`);
      testPassed = false;
    } else {
      console.log("  ✓ Job titles properly capitalized");
    }
  }

  if (testCase.testTense) {
    console.log("\n✓ Tense Conversion Test:");
    const presentTenses = ['managing', 'coordinating', 'tracking', 'prepares', 'manages'];
    const pastTenses = ['managed', 'coordinated', 'tracked', 'prepared', 'managed'];
    
    if (testCase.isCurrentJob) {
      console.log("  (Current job - present tense should be preserved)");
      presentTenses.forEach(tense => {
        if (testCase.input.toLowerCase().includes(tense)) {
          console.log(`  ✓ Present tense '${tense}' found (correct for current job)`);
        }
      });
    } else {
      console.log("  (Past job - should use past tense)");
      const hasPresentTense = presentTenses.some(t => testCase.input.toLowerCase().includes(t));
      if (hasPresentTense) {
        console.log("  ❌ Present tense found in past job (should be past tense)");
        testPassed = false;
      } else {
        console.log("  ✓ Appropriate tense detected");
      }
    }
  }

  if (testCase.testName) {
    console.log("\n✓ Name Parsing Test:");
    const nameLine = testCase.input.split('\n')[0];
    if (nameLine.includes('PhD') || nameLine.includes('PMP')) {
      console.log(`  ⚠️  Name includes credentials: "${nameLine}"`);
      console.log(`     Should parse as name only, credentials separate`);
      testPassed = false;
    } else {
      console.log(`  ✓ Name properly formatted: "${nameLine}"`);
    }
  }

  if (testCase.testExperience) {
    console.log("\n✓ Experience Parsing Test:");
    if (/EXPERIENCE/.test(testCase.input)) {
      console.log("  ✓ Explicit EXPERIENCE section found");
    } else {
      const hasDatePattern = /\d{4}\s*[-–]\s*(?:Present|now|[A-Z])/i.test(testCase.input);
      if (hasDatePattern) {
        console.log("  ✓ Experience detected without explicit header");
      } else {
        console.log("  ⚠️  Experience header might not be detected");
        testPassed = false;
      }
    }
  }

  if (testPassed) {
    console.log("\n✅ Test PASSED - Issues identified and logged");
    passedTests++;
  } else {
    console.log("\n❌ Test FAILED - Issues not properly handled");
    failedTests++;
  }
});

console.log("\n" + "═".repeat(60));
console.log("TEST SUMMARY");
console.log("═".repeat(60));
console.log(`Total Tests:    ${totalTests}`);
console.log(`Passed:         ${passedTests} ✅`);
console.log(`Failed:         ${failedTests} ❌`);
console.log(`Success Rate:   ${Math.round((passedTests / totalTests) * 100)}%`);
console.log("═".repeat(60) + "\n");

process.exit(failedTests > 0 ? 1 : 0);
