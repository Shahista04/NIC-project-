# NIC-project-       ANUBHAV Feedback form 

## to run this project 
open mongodb and connect with database (police_feedback_system)
</br>
collection 1 - feedbacksubmissions
</br>
collection 2 - questions
</br>
collection 3 - 
</br>


1) open cmd as administrator and type these commands
 </br>
      net start mongodb
   </br>
      sc query mongodb
   </br>
      cd (set path)
   </br>
      npm run dev
   </br>

open  http://localhost:5000  ( to view feedback form in you browser )
</br>

open http://localhost:5000/admin ( to view admin login in you browser )
</br>

2) open cmd as administrator and type this commands
</br>
      cd (set path)
   </br>
      python report_service.py
   </br>
  it will use port 5001
</br>
  follow these steps to enable report generating
</br>

### packages needs to be installed -

#### node.js packages 
npm install express cors bcryptjs jsonwebtoken 
</br>
npm install -D nodemon 

#### python packages - 
pip install flask flask-cors pymongo flask-bcrypt pyjwt
