I am planning to create a web application for workout tracker, timer, etc.

Deployment:
- I am thinking of deploying this via github version control to Vercel.


Web App features:
- Should be able to support multiple users. Via auth login or something.
- Upon opening I want the dashboard to contain the following:
  - see a weekly calendar or something
  - workout streak tracker display or something
  - workout plan manager
  - and a button to start working out. 
- in workout plan manager i should be able to plan the types of workout i will be doing in that specific plan (eg. Workout Plan 1 contains: push-ups, lateral raises, bicep curls etc.), this should be in order. the workout plan should also set the default rest time in mm:ss.
  - it should contain features like adding, editing, and deleting a workout plan
  - in editing or creating a workout plan, i should be able to add or delete any workout type. and edit the default rest time.
- upon starting a workout, I should be prompted to select a workout plan. if no workout plan was previously established, you should have a proposed workout plan for chest, shoulder, arm, etc or any combination days. just basic workout plan suggestion or preset
  - upon selecting which workout plan is to be started, the timer should start counting (in the whole workout routing, I should be able to see this timer)
  - after the user is finished with his first set of the workout, the user is expected to input the number of reps for that workout.
  - once the user pressed "set finished" you should save it in this format (for example push up is the workout type):
    - Push-up:
      - Set 1: 12 reps
  - the rest counter should then start counting. during the rest counter countdown, the user can add in increments of 10 seconds, then this should be reflected to the rest counter. 
  - once the rest counter reaches zero, we will be proceeding to the next set of the workout  type.
  - after the user finished the workout, and pressed "set finished" append another set log to the previous as follows:
    - Push-up:
      - Set 1: 12 reps
      - Set 2: 10 reps
  - This should continue as long as the user keeps pressing set finished
  - There should be another button called "Finish Exercise" which will trigger the end of that specific workout type then we will proceed to the next wrokout type as establihsed in our workout plan. 
  - The whole flow should be the same, "set finished" logs the reps of the specific set, "exercise finish" ends the workout type then proceed to the next.
  - Once all workout types are finished, we stop the workout timer. 
  - An exercise log should then be shown, the list of all exercise and their reps and sets, the total rest time, the total workout time, and all other data we can report recommend a layout figure it out.

Database management:
- We will use Neon Postgre database to store all data.
- Establish proper RDBS for the whole system that we are building. Make sure each user have their own User_ID.