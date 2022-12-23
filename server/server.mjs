import  fastify from 'fastify';
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import pg from 'pg';
import {hash,compare} from 'bcrypt';
import jwt from 'jsonwebtoken';

const{sign,verify}=jwt;

const {Client}=pg;
const client= new Client({
    database:'todo',
    user:'postgres',
    password:'postgres',
    port:5556,
    host:'localhost',
});
const server=fastify({
    logger:true,
});
const SECRET_KEY='VEry Str0ng SEcret Key';
server.register(fastifyCors);
server.register(fastifyMultipart,{
    addToBody:true,
});
server.register('/register',{
    schema:authSchema,
},
    async (request,reply)=>{
    const {email,password}=request.body;
    const{rows}=await client.query('SELECT * FROM users WHERE email=$1;',[
        email,
    ]);
    if(!rows.length){
        const hashedPassword=await hash(password,10)
    await client.query('INSERT INTO users(email,password) VALUES($1,$2);',[email,hashedPassword]);
    return reply.send({
        info:'User sucsessful created'
    })
    }
    reply.status(400).send({
        info:'user already exist'
    })
})
const authSchema={
    body:{
        type:'object',
        properties:{
            email:{
                type:'string',
                minLength:6,
                maxLength:30,
            },
            password:{
                type:'string',
                minLength: 8,
                maxLength: 50
            }
        },
        required:['email','password']
    }
}
server.post('/login',{schema:authSchema}, async (request,reply)=>{
    const{email,password}=request.body;
    const{rows}=await client.query('SELECT * FROM users WHERE email=$1;',[
        email,
    ]);
    if(rows.length) {
        const [user] = rows;
        const isValidPassword=await compare(password, user.password);
        // return  reply.send(rows)
        if(isValidPassword){
            const token= await sign({id:user.id,email:user.email},SECRET_KEY,
                {expiresIn:'5m'})
           return reply.send({
               info: 'Succsessful login',token
           })
               return reply.status(400).send({info:'Incorect password'})
        }
    }
    reply.status(400).send({
        info:'user does not exist'
    })

    server.get('/tasks',{
        schema:{
            headers:{
                type:'object',
                properties:{
                    token:{
                        type:'string'
                    }
                },
                required: ['token'],
            }
        }
    },async (request,reply)=>{
    const payload=await verifyRequest(request);
    if(payload){
       const{id}=payload;
       const{rows:tasks}=await client.query('SELECT * FROM tasks WHERE userid=$1',[id]);
       reply.send(tasks);
    }
    return reply.status(401).send('You are not autorized')
    });

    server.post('/tasks',{
        schema:{
            headers:{
                type:'object',
                properties:{
                    token:{
                        type:'string'
                    }
                },
                required: ['token'],
            },
            body:{
                type:'object',
                properties:{
                    name:{
                        type:'string',
                    },
                    deadline:{
                        type:'string'
                    },
                },
                required:['name', 'deadline']
            },
        },
    },async (request,reply)=>{
        const payload=await verifyRequest(request);
        const {name, deadline}=request.body
        if(payload){
        await client.query('INSERT INTO tasks(name,deadline) VALUES($1,$2,$3);',[name,deadline,payload.id]);
        reply.send({info:'created'})
        }
        reply.status(401).send('unauthoraised')
    })

    async function verifyRequest(request) {
        const{token}=request.headers;

        try {
            const payload=await verify(token,SECRET_KEY);
            return payload;
        }catch (err){
            return false;
        }
    }


    server.post('/verify',async (request,reply)=>{
        const{token}=request.headers;
        try {
            const payload=await verify(token,SECRET_KEY);
            reply.send(payload);
        } catch (err){
            reply.status(401).send(err.message)
        }
    })
})

server.listen({
    port:4000,
    host:'0.0.0.0'
})
.then(()=>{
// return client.connect();
}).catch(err=>console.log(err));


// const hash=btoa('hi all');
// atob(hash);



